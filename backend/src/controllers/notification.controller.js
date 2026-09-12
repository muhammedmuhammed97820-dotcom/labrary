const Notification = require('../models/Notification');

function serialize(notification) {
  const value = typeof notification.toObject === 'function' ? notification.toObject() : { ...notification };
  return {
    id: String(value._id),
    type: value.type,
    title: value.title,
    text: value.text,
    link: value.link || '',
    unread: !value.read,
    createdAt: value.createdAt
  };
}

async function list(req, res) {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30);
    res.json({ notifications: notifications.map(serialize), unreadCount: notifications.filter(item => !item.read).length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load notifications.' });
  }
}

async function markAllRead(req, res) {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ message: 'Notifications marked as read.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update notifications.' });
  }
}

module.exports = { list, markAllRead };
