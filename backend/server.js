/**
 * Live Debate — mock backend (Express + in-memory state)
 * Aligns with frontend utils/api-service.js and admin/admin-api.js paths.
 */
const http = require('http');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const PORT = Number(process.env.PORT || 8000);

const app = express();
const server = http.createServer(app);

let WebSocketServer;
try {
	WebSocketServer = require('ws').WebSocketServer;
} catch (e) {
	console.warn('请运行: npm install ws');
}

const wsClients = new Set();

function broadcastWs(payload) {
	const raw = JSON.stringify(payload);
	wsClients.forEach((client) => {
		if (client.readyState === 1) client.send(raw);
	});
}

function notifyLiveWebSocket() {
	broadcastWs({
		type: 'live-status-changed',
		streamId: globalLive.streamId,
		data: {
			isLive: globalLive.isLive,
			status: globalLive.isLive ? 'started' : 'stopped',
			streamUrl: globalLive.streamUrl,
			streamId: globalLive.streamId,
			liveId: globalLive.liveId,
			timestamp: Date.now()
		},
		timestamp: Date.now()
	});
	broadcastWs({
		type: 'liveStatus',
		streamId: globalLive.streamId,
		data: {
			isLive: globalLive.isLive,
			streamUrl: globalLive.streamUrl,
			streamId: globalLive.streamId
		},
		timestamp: Date.now()
	});
}

if (WebSocketServer) {
	const wss = new WebSocketServer({ server, path: '/ws' });
	wss.on('connection', (ws) => {
		wsClients.add(ws);
		ws.send(
			JSON.stringify({
				type: 'connected',
				message: '已连接到 live-debate-backend WebSocket'
			})
		);
		ws.on('message', (raw) => {
			try {
				const data = JSON.parse(raw.toString());
				if (data.type === 'ping') {
					ws.send(JSON.stringify({ type: 'pong' }));
				}
			} catch (_) {
				/* ignore */
			}
		});
		ws.on('close', () => wsClients.delete(ws));
		ws.on('error', () => wsClients.delete(ws));
	});
}
app.use(
	cors({
		origin: '*',
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
		credentials: true
	})
);
app.use(express.json({ limit: '2mb' }));

// ---------- Mock seed ----------
const DEFAULT_DEBATE = {
	id: 'debate-default-001',
	title: '如果有一个能一键消除痛苦的按钮，你会按吗？',
	description: '这是一个关于痛苦、成长与人性选择的深度辩论',
	leftPosition: '会按',
	rightPosition: '不会按',
	leftSide: '会按',
	rightSide: '不会按'
};

function makeAiSeed(debateId) {
	const t = Date.now();
	return [
		{
			id: uuidv4(),
			debate_id: debateId,
			text: '正方观点：痛苦是人生成长的必要经历，消除痛苦会让我们失去学习和成长的机会。',
			side: 'left',
			timestamp: t - 300000,
			comments: [],
			likes: 45
		},
		{
			id: uuidv4(),
			debate_id: debateId,
			text: '反方观点：如果能够消除痛苦，为什么不呢？痛苦本身没有价值。',
			side: 'right',
			timestamp: t - 240000,
			comments: [],
			likes: 52
		}
	];
}

const streams = [
	{
		id: 'stream-demo-001',
		name: '演示直播流',
		url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
		type: 'hls',
		enabled: true,
		description: 'Mux 测试 HLS，用于多端演示',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	}
];

const votesByStream = {
	'stream-demo-001': { leftVotes: 120, rightVotes: 98 }
};

const aiByStream = {
	'stream-demo-001': makeAiSeed(DEFAULT_DEBATE.id)
};

const userVoteRecords = new Map();

const globalLive = {
	isLive: false,
	streamUrl: null,
	streamId: null,
	liveId: null,
	startTime: null,
	isScheduled: false,
	scheduledStartTime: null,
	scheduledEndTime: null
};

const scheduleState = {
	scheduledStartTime: null,
	scheduledEndTime: null,
	streamId: null,
	debateId: null,
	isScheduled: false
};

let aiSession = { status: 'idle', aiSessionId: null, startTime: null };

const mockUsers = [
	{
		id: 'user-mock-1',
		nickname: '演示用户A',
		avatar: '/static/logo.png',
		joinTime: new Date().toISOString(),
		statistics: { totalVotes: 30, totalComments: 2, totalLikes: 5, currentPosition: 'left' }
	}
];

// ---------- Helpers ----------
function qStreamId(req) {
	return (
		req.query.stream_id ||
		req.query.streamId ||
		(req.body && (req.body.stream_id || req.body.streamId)) ||
		null
	);
}

function unwrapBody(req) {
	const b = req.body || {};
	if (b.request && typeof b.request === 'object') return { ...b.request, _wrapped: true };
	return b;
}

function getVotesForStream(streamId) {
	const sid = streamId || 'stream-demo-001';
	if (!votesByStream[sid]) votesByStream[sid] = { leftVotes: 0, rightVotes: 0 };
	return votesByStream[sid];
}

function pct(a, b) {
	const t = a + b;
	if (t <= 0) return { l: 50, r: 50 };
	return {
		l: Math.round((a / t) * 100),
		r: Math.round((b / t) * 100)
	};
}

function votePayload(streamId) {
	const { leftVotes, rightVotes } = getVotesForStream(streamId);
	const total = leftVotes + rightVotes;
	const p = pct(leftVotes, rightVotes);
	return {
		success: true,
		data: {
			stream_id: streamId,
			leftVotes,
			rightVotes,
			totalVotes: total,
			leftPercentage: p.l,
			rightPercentage: p.r
		}
	};
}

const debateByStream = {};

function debateForStream(streamId) {
	if (streamId && debateByStream[streamId]) return { ...DEFAULT_DEBATE, ...debateByStream[streamId] };
	return { ...DEFAULT_DEBATE };
}

function aiListForStream(streamId) {
	const sid = streamId || 'stream-demo-001';
	if (!aiByStream[sid]) aiByStream[sid] = makeAiSeed(debateForStream(sid).id);
	return aiByStream[sid];
}

function optionalAuth(req, res, next) {
	const auth = req.headers.authorization;
	if (auth && auth.startsWith('Bearer ')) req.mockUserToken = auth.slice(7);
	next();
}

app.use(optionalAuth);

// ---------- Health ----------
app.get('/health', (req, res) => {
	res.json({ ok: true, service: 'live-debate-backend', time: new Date().toISOString() });
});

// ---------- Public votes ----------
app.get(['/api/votes', '/api/v1/votes'], (req, res) => {
	const streamId = qStreamId(req) || 'stream-demo-001';
	res.json(votePayload(streamId));
});

// ---------- User vote ----------
function handleUserVote(req, res) {
	const raw = unwrapBody(req);
	const leftVotes = parseInt(raw.leftVotes, 10);
	const rightVotes = parseInt(raw.rightVotes, 10);
	const streamId =
		raw.stream_id || raw.streamId || qStreamId(req) || 'stream-demo-001';

	if (Number.isNaN(leftVotes) || Number.isNaN(rightVotes)) {
		return res.status(400).json({ success: false, message: 'leftVotes/rightVotes 必须为数字' });
	}
	if (leftVotes + rightVotes !== 100) {
		return res.status(400).json({
			success: false,
			message: `票数分配错误: 正方 ${leftVotes} + 反方 ${rightVotes} = ${leftVotes + rightVotes}，必须等于100`
		});
	}
	const bucket = getVotesForStream(streamId);
	bucket.leftVotes += leftVotes;
	bucket.rightVotes += rightVotes;

	const uid = raw.userId || raw.user_id || 'anonymous';
	const key = `${streamId}:${uid}`;
	userVoteRecords.set(key, { leftVotes, rightVotes, streamId, userId: uid, at: new Date().toISOString() });

	res.json(votePayload(streamId));
}

app.post(['/api/user-vote', '/api/v1/user-vote'], handleUserVote);

// ---------- Debate topic ----------
app.get(['/api/debate-topic', '/api/v1/debate-topic'], (req, res) => {
	const streamId = qStreamId(req);
	const d = debateForStream(streamId);
	res.json({
		success: true,
		data: {
			id: d.id,
			title: d.title,
			description: d.description,
			leftSide: d.leftSide || d.leftPosition,
			rightSide: d.rightSide || d.rightPosition,
			leftPosition: d.leftPosition,
			rightPosition: d.rightPosition
		}
	});
});

// ---------- AI content (client) ----------
app.get(['/api/ai-content', '/api/v1/ai-content'], (req, res) => {
	const streamId = qStreamId(req) || 'stream-demo-001';
	res.json({ success: true, data: aiListForStream(streamId) });
});

app.post('/api/comment', (req, res) => {
	const { contentId, user, text, avatar } = req.body || {};
	if (!contentId || !text || !String(text).trim()) {
		return res.status(400).json({ success: false, message: '缺少必要参数: contentId 和 text' });
	}
	const streamId = qStreamId(req) || 'stream-demo-001';
	const list = aiListForStream(streamId);
	const content = list.find((item) => String(item.id) === String(contentId));
	if (!content) {
		return res.status(404).json({ success: false, message: '内容不存在' });
	}
	const newComment = {
		id: uuidv4(),
		user: user || '匿名用户',
		text: String(text).trim(),
		time: '刚刚',
		avatar: avatar || '👤',
		likes: 0
	};
	content.comments = content.comments || [];
	content.comments.push(newComment);
	res.json({ success: true, data: newComment });
});

app.delete('/api/comment/:commentId', (req, res) => {
	const { commentId } = req.params;
	const { contentId } = req.body || {};
	if (!commentId || !contentId) {
		return res.status(400).json({ success: false, message: '缺少必要参数: commentId 和 contentId' });
	}
	const streamId = qStreamId(req) || 'stream-demo-001';
	const list = aiListForStream(streamId);
	const content = list.find((item) => String(item.id) === String(contentId));
	if (!content) return res.status(404).json({ success: false, message: '内容不存在' });
	const idx = (content.comments || []).findIndex((c) => String(c.id) === String(commentId));
	if (idx === -1) return res.status(404).json({ success: false, message: '评论不存在' });
	const deleted = content.comments.splice(idx, 1)[0];
	res.json({
		success: true,
		data: { message: '评论删除成功', deletedComment: deleted }
	});
});

app.post('/api/like', (req, res) => {
	const { contentId, commentId } = req.body || {};
	if (!contentId) return res.status(400).json({ success: false, message: '缺少必要参数: contentId' });
	const streamId = qStreamId(req) || 'stream-demo-001';
	const list = aiListForStream(streamId);
	const content = list.find((item) => String(item.id) === String(contentId));
	if (!content) return res.status(404).json({ success: false, message: '内容不存在' });
	if (commentId != null) {
		const comment = (content.comments || []).find((c) => String(c.id) === String(commentId));
		if (!comment) return res.status(404).json({ success: false, message: '评论不存在' });
		comment.likes = (comment.likes || 0) + 1;
		return res.json({ success: true, data: { likes: comment.likes } });
	}
	content.likes = (content.likes || 0) + 1;
	res.json({ success: true, data: { likes: content.likes } });
});

// ---------- User vote history ----------
app.get('/api/v1/user-votes', (req, res) => {
	const streamId = req.query.stream_id;
	const userId = req.query.user_id;
	if (!streamId || !userId) {
		return res.status(400).json({ success: false, message: '需要 stream_id 与 user_id' });
	}
	const rec = userVoteRecords.get(`${streamId}:${userId}`);
	res.json({
		success: true,
		data: rec || { leftVotes: 0, rightVotes: 0, streamId, userId }
	});
});

// ---------- WeChat login (mock) ----------
app.post('/api/wechat-login', (req, res) => {
	const { code, userInfo } = req.body || {};
	if (!code) {
		return res.status(400).json({ success: false, message: '缺少必要参数: code' });
	}
	const openid = `mock_openid_${Date.now()}`;
	res.json({
		success: true,
		data: {
			openid,
			session_key: 'mock_session',
			unionid: null,
			userInfo: userInfo || { nickName: '演示用户', avatarUrl: '/static/logo.png' },
			loginTime: new Date().toISOString(),
			isMock: true
		}
	});
});

// ---------- Live status & control ----------
app.get('/api/admin/live/status', (req, res) => {
	const active = streams.find((s) => s.enabled);
	res.json({
		...globalLive,
		schedule: scheduleState,
		activeStreamUrl: active ? active.url : null,
		activeStreamId: active ? active.id : null,
		activeStreamName: active ? active.name : null
	});
});

app.post('/api/live/control', (req, res) => {
	const { action, streamId } = req.body || {};
	if (action === 'start') {
		let s = streamId ? streams.find((x) => x.id === streamId) : streams.find((x) => x.enabled);
		if (!s) {
			return res.status(400).json({
				success: false,
				message: '没有可用的直播流'
			});
		}
		globalLive.isLive = true;
		globalLive.streamUrl = s.url;
		globalLive.streamId = s.id;
		globalLive.liveId = uuidv4();
		globalLive.startTime = new Date().toISOString();
		notifyLiveWebSocket();
		return res.json({
			success: true,
			message: '直播已开始',
			data: {
				status: 'started',
				streamUrl: globalLive.streamUrl,
				streamId: s.id,
				streamName: s.name
			}
		});
	}
	if (action === 'stop') {
		globalLive.isLive = false;
		globalLive.streamUrl = null;
		globalLive.streamId = null;
		notifyLiveWebSocket();
		return res.json({ success: true, message: '直播已停止', data: { status: 'stopped' } });
	}
	return res.status(400).json({
		success: false,
		message: '无效的操作，action 必须是 "start" 或 "stop"'
	});
});

// ---------- Dashboard ----------
function buildDashboard(streamId) {
	const sid = streamId || globalLive.streamId || 'stream-demo-001';
	const v = getVotesForStream(sid);
	const totalVotes = v.leftVotes + v.rightVotes;
	const p = pct(v.leftVotes, v.rightVotes);
	const d = debateForStream(sid);
	let liveDuration = 0;
	if (globalLive.isLive && globalLive.startTime) {
		liveDuration = Math.floor((Date.now() - new Date(globalLive.startTime).getTime()) / 1000);
	}
	const active = streams.find((s) => s.enabled);
	return {
		totalUsers: mockUsers.length,
		activeUsers: 1,
		isLive: globalLive.isLive,
		liveStreamUrl: globalLive.streamUrl,
		streamId: globalLive.streamId,
		activeStreamUrl: active ? active.url : null,
		activeStreamId: active ? active.id : null,
		activeStreamName: active ? active.name : null,
		totalVotes,
		leftVotes: v.leftVotes,
		rightVotes: v.rightVotes,
		leftPercentage: p.l,
		rightPercentage: p.r,
		totalComments: 0,
		totalLikes: 0,
		aiStatus: aiSession.status,
		debateTopic: {
			title: d.title,
			leftSide: d.leftSide || d.leftPosition,
			rightSide: d.rightSide || d.rightPosition,
			description: d.description
		},
		liveStartTime: globalLive.startTime,
		liveDuration
	};
}

app.get('/api/admin/dashboard', (req, res) => {
	res.json({ success: true, data: buildDashboard(qStreamId(req)), timestamp: Date.now() });
});

app.get('/api/v1/admin/dashboard', (req, res) => {
	res.json({ success: true, data: buildDashboard(qStreamId(req)), timestamp: Date.now() });
});

// ---------- Streams ----------
app.get(['/api/admin/streams', '/api/v1/admin/streams'], (req, res) => {
	res.json({
		success: true,
		data: { streams: [...streams], total: streams.length },
		timestamp: Date.now()
	});
});

app.post('/api/admin/streams', (req, res) => {
	const { name, url, type, description, enabled } = req.body || {};
	if (!name || !url) {
		return res.status(400).json({ success: false, message: 'name 与 url 必填' });
	}
	const s = {
		id: uuidv4(),
		name: String(name).trim(),
		url: String(url).trim(),
		type: type || 'hls',
		description: description || '',
		enabled: !!enabled,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
	streams.push(s);
	votesByStream[s.id] = { leftVotes: 0, rightVotes: 0 };
	aiByStream[s.id] = makeAiSeed(DEFAULT_DEBATE.id);
	res.json({ success: true, data: s, message: '创建成功' });
});

// ---------- Votes statistics ----------
app.get(['/api/admin/votes/statistics', '/api/v1/admin/votes/statistics'], (req, res) => {
	const streamId = qStreamId(req);
	const v = getVotesForStream(streamId || 'stream-demo-001');
	const totalVotes = v.leftVotes + v.rightVotes;
	const p = pct(v.leftVotes, v.rightVotes);
	const timeline = [];
	const now = Date.now();
	for (let i = 0; i < 10; i++) {
		timeline.unshift({
			timestamp: new Date(now - i * 60000).toISOString(),
			leftVotes: Math.floor((v.leftVotes * (10 - i)) / 10),
			rightVotes: Math.floor((v.rightVotes * (10 - i)) / 10),
			totalVotes: Math.floor((totalVotes * (10 - i)) / 10),
			activeUsers: 1
		});
	}
	res.json({
		success: true,
		data: {
			summary: {
				totalVotes,
				leftVotes: v.leftVotes,
				rightVotes: v.rightVotes,
				leftPercentage: p.l,
				rightPercentage: p.r,
				growthRate: 3.5
			},
			timeline,
			topVoters: []
		},
		timestamp: Date.now()
	});
});

// ---------- RTMP / SRS mock ----------
app.get('/api/admin/rtmp/urls', (req, res) => {
	const room = req.query.room_name || 'demo';
	const base = `http://127.0.0.1:8085/live/${encodeURIComponent(room)}`;
	res.json({
		success: true,
		data: {
			room_name: room,
			push_url: `rtmp://127.0.0.1:1935/live/${room}`,
			play_flv: `${base}.flv`,
			play_hls: `${base}.m3u8`
		}
	});
});

// ---------- Admin v1 live / ai (stubs with state) ----------
app.post('/api/v1/admin/live/start', (req, res) => {
	const { streamId, autoStartAI, notifyUsers } = req.body || {};
	const sid = streamId || 'stream-demo-001';
	const s = streams.find((x) => x.id === sid);
	if (!s) return res.status(404).json({ success: false, message: '直播流不存在' });
	globalLive.isLive = true;
	globalLive.streamUrl = s.url;
	globalLive.streamId = s.id;
	globalLive.liveId = uuidv4();
	globalLive.startTime = new Date().toISOString();
	if (autoStartAI) {
		aiSession = { status: 'running', aiSessionId: uuidv4(), startTime: globalLive.startTime };
	}
	notifyLiveWebSocket();
	res.json({
		success: true,
		data: {
			liveId: globalLive.liveId,
			streamUrl: s.url,
			status: 'started',
			notifiedUsers: notifyUsers ? 1 : 0
		}
	});
});

app.post('/api/v1/admin/live/stop', (req, res) => {
	globalLive.isLive = false;
	globalLive.streamUrl = null;
	globalLive.streamId = null;
	aiSession.status = 'idle';
	notifyLiveWebSocket();
	res.json({ success: true, data: { status: 'stopped' } });
});

app.post('/api/v1/admin/live/update-votes', (req, res) => {
	const { streamId, leftVotes, rightVotes } = req.body || {};
	const sid = streamId || 'stream-demo-001';
	const b = getVotesForStream(sid);
	if (typeof leftVotes === 'number') b.leftVotes = leftVotes;
	if (typeof rightVotes === 'number') b.rightVotes = rightVotes;
	res.json({ success: true, data: votePayload(sid).data });
});

app.post('/api/v1/admin/live/reset-votes', (req, res) => {
	const { streamId } = req.body || {};
	const sid = streamId || 'stream-demo-001';
	votesByStream[sid] = { leftVotes: 0, rightVotes: 0 };
	res.json({ success: true, data: votePayload(sid).data });
});

app.post('/api/v1/admin/ai/start', (req, res) => {
	aiSession = { status: 'running', aiSessionId: uuidv4(), startTime: new Date().toISOString() };
	res.json({ success: true, data: aiSession });
});

app.post('/api/v1/admin/ai/stop', (req, res) => {
	aiSession = { status: 'idle', aiSessionId: null, startTime: null };
	res.json({ success: true, data: aiSession });
});

app.post('/api/v1/admin/ai/toggle', (req, res) => {
	aiSession.status = aiSession.status === 'running' ? 'idle' : 'running';
	res.json({ success: true, data: aiSession });
});

app.delete('/api/v1/admin/ai/content/:contentId', (req, res) => {
	const { streamId } = req.query;
	const sid = streamId || 'stream-demo-001';
	const list = aiListForStream(sid);
	const idx = list.findIndex((x) => x.id === req.params.contentId);
	if (idx === -1) return res.status(404).json({ success: false, message: '内容不存在' });
	list.splice(idx, 1);
	res.json({ success: true, data: { contentId: req.params.contentId } });
});

// ---------- AI content admin list ----------
app.get('/api/v1/admin/ai-content/list', (req, res) => {
	const streamId = qStreamId(req) || 'stream-demo-001';
	const page = parseInt(req.query.page, 10) || 1;
	const pageSize = parseInt(req.query.pageSize, 10) || 50;
	const all = aiListForStream(streamId);
	const slice = all.slice((page - 1) * pageSize, page * pageSize);
	res.json({
		success: true,
		data: { list: slice, total: all.length, page, pageSize },
		timestamp: Date.now()
	});
});

app.get('/api/v1/admin/ai-content/:id/comments', (req, res) => {
	const streamId = qStreamId(req) || 'stream-demo-001';
	const list = aiListForStream(streamId);
	const item = list.find((x) => x.id === req.params.id);
	if (!item) return res.status(404).json({ success: false, message: '内容不存在' });
	res.json({ success: true, data: { comments: item.comments || [] } });
});

app.delete('/api/v1/admin/ai-content/:id/comments/:commentId', (req, res) => {
	const streamId = qStreamId(req) || 'stream-demo-001';
	const list = aiListForStream(streamId);
	const item = list.find((x) => x.id === req.params.id);
	if (!item) return res.status(404).json({ success: false, message: '内容不存在' });
	const idx = (item.comments || []).findIndex((c) => c.id === req.params.commentId);
	if (idx === -1) return res.status(404).json({ success: false, message: '评论不存在' });
	item.comments.splice(idx, 1);
	res.json({ success: true, data: {} });
});

// ---------- Viewers mock（与管理端 admin-api 中 result.data.viewers / streams 对齐）----------
app.get('/api/v1/admin/live/viewers', (req, res) => {
	const streamId = req.query.stream_id || req.query.streamId;
	const viewers = 42;
	const list = [{ userId: 'u1', nickname: '观众1' }];
	const streams = { 'stream-demo-001': viewers };
	res.json({
		success: true,
		data: {
			viewers,
			total: viewers,
			list,
			streams,
			streamId: streamId || null
		},
		timestamp: Date.now()
	});
});

app.get('/api/v1/admin/live/broadcast-viewers', (req, res) => {
	res.json({ success: true, data: { total: 10 } });
});

// ---------- Users ----------
app.get('/api/v1/admin/users', (req, res) => {
	res.json({
		success: true,
		data: { users: mockUsers, total: mockUsers.length },
		timestamp: Date.now()
	});
});

app.get('/api/admin/miniprogram/users', (req, res) => {
	const page = parseInt(req.query.page, 10) || 1;
	const pageSize = parseInt(req.query.pageSize, 10) || 20;
	res.json({
		success: true,
		data: {
			total: mockUsers.length,
			page,
			pageSize,
			users: mockUsers.map((u) => ({
				userId: u.id,
				nickname: u.nickname,
				avatar: u.avatar,
				status: 'online',
				lastActiveTime: new Date().toISOString(),
				statistics: u.statistics,
				joinTime: u.joinTime
			}))
		},
		timestamp: Date.now()
	});
});

// ---------- Debates admin (minimal) ----------
app.get('/api/v1/admin/debates', (req, res) => {
	res.json({ success: true, data: { debates: [debateForStream(null)], total: 1 } });
});

app.get('/api/v1/admin/streams/:streamId/debate', (req, res) => {
	res.json({ success: true, data: debateForStream(req.params.streamId) });
});

app.put('/api/v1/admin/streams/:streamId/debate', (req, res) => {
	const merged = { ...debateForStream(req.params.streamId), ...(req.body || {}) };
	debateByStream[req.params.streamId] = merged;
	res.json({ success: true, data: merged });
});

// ---------- Fallback ----------
app.use((req, res) => {
	if (req.path.startsWith('/api')) {
		return res.status(404).json({
			success: false,
			message: `未实现的接口: ${req.method} ${req.path}`,
			hint: '参见项目 README 中的接口清单；部分管理端扩展接口可后续补充'
		});
	}
	res.status(404).send('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
	console.log(`live-debate-backend listening on http://0.0.0.0:${PORT}`);
	if (WebSocketServer) {
		console.log(`WebSocket: ws://localhost:${PORT}/ws`);
	}
});
