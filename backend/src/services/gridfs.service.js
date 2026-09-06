const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');

function getBucket(bucketName = 'libraryFiles') {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not ready.');
  return new GridFSBucket(db, { bucketName });
}

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (!ObjectId.isValid(String(id))) return null;
  return new ObjectId(String(id));
}

async function uploadBuffer(buffer, filename, contentType, metadata = {}, bucketName = 'libraryFiles') {
  if (!buffer || !buffer.length) throw new Error('File buffer is empty.');
  const bucket = getBucket(bucketName);
  const id = new ObjectId();
  const uploadStream = bucket.openUploadStreamWithId(id, filename, {
    contentType,
    metadata
  });

  await new Promise((resolve, reject) => {
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
    uploadStream.end(buffer);
  });

  return id;
}

async function getFile(id, bucketName = 'libraryFiles') {
  const objectId = toObjectId(id);
  if (!objectId) return null;
  const files = await getBucket(bucketName).find({ _id: objectId }).toArray();
  return files[0] || null;
}

function openDownloadStream(id, bucketName = 'libraryFiles', options) {
  const objectId = toObjectId(id);
  if (!objectId) return null;
  return getBucket(bucketName).openDownloadStream(objectId, options);
}

async function deleteFile(id, bucketName = 'libraryFiles') {
  const objectId = toObjectId(id);
  if (!objectId) return;
  try {
    await getBucket(bucketName).delete(objectId);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

module.exports = { getBucket, toObjectId, uploadBuffer, getFile, openDownloadStream, deleteFile };
