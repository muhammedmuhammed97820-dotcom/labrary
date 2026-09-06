require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDatabase = require("../config/database");
const Book = require("../models/Book");
const Author = require("../models/Author");
const User = require("../models/user.model");
const { uploadBuffer } = require("../services/gridfs.service");

function localFile(relativeOrAbsolute, directory) {
  const value = String(relativeOrAbsolute || "");
  const filename = path.basename(value);
  if (!filename) return null;
  return path.join(path.resolve(directory), filename);
}

function imageMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
}

async function migrateUsers() {
  const dir = process.env.UPLOAD_AVATARS_DIR || "uploads/avatars";
  const users = await User.find({ avatarFileId: null, avatar: { $regex: "^/uploads/avatars/" } });
  let count = 0;
  for (const user of users) {
    const filePath = localFile(user.avatar, dir);
    if (!filePath || !fs.existsSync(filePath)) continue;
    const filename = path.basename(filePath);
    user.avatarFileId = await uploadBuffer(fs.readFileSync(filePath), filename, imageMime(filename), { type: "profile-avatar", userId: user._id.toString(), migratedFrom: user.avatar }, "libraryAvatars");
    user.avatar = null;
    await user.save();
    count++;
  }
  return count;
}

async function migrateAuthors() {
  const dir = process.env.UPLOAD_AVATARS_DIR || "uploads/avatars";
  const authors = await Author.find({ imageId: null, image: { $regex: "^/uploads/" } });
  let count = 0;
  for (const author of authors) {
    const filePath = localFile(author.image, dir);
    if (!filePath || !fs.existsSync(filePath)) continue;
    const filename = path.basename(filePath);
    author.imageId = await uploadBuffer(fs.readFileSync(filePath), filename, imageMime(filename), { type: "author-image", authorId: author._id.toString(), migratedFrom: author.image }, "libraryAuthors");
    author.image = "";
    await author.save();
    count++;
  }
  return count;
}

async function migrateBooks() {
  const booksDir = process.env.UPLOAD_BOOKS_DIR || "uploads/books";
  const coversDir = process.env.UPLOAD_COVERS_DIR || "uploads/covers";
  const books = await Book.find({ $or: [{ fileId: null }, { coverImageId: null }] });
  let files = 0;
  let covers = 0;
  for (const book of books) {
    if (!book.fileId && book.filePath) {
      const filePath = localFile(book.filePath, booksDir);
      if (filePath && fs.existsSync(filePath)) {
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();
        const type = ext === ".pdf" ? "application/pdf" : "application/epub+zip";
        book.fileId = await uploadBuffer(fs.readFileSync(filePath), filename, type, { type: "book-file", bookId: book._id.toString(), migratedFrom: book.filePath }, "libraryBooks");
        files++;
      }
    }
    if (!book.coverImageId && book.coverImage) {
      const filePath = localFile(book.coverImage, coversDir);
      if (filePath && fs.existsSync(filePath)) {
        const filename = path.basename(filePath);
        book.coverImageId = await uploadBuffer(fs.readFileSync(filePath), filename, imageMime(filename), { type: "book-cover", bookId: book._id.toString(), migratedFrom: book.coverImage }, "libraryCovers");
        covers++;
      }
    }
    await book.save();
  }
  return { files, covers };
}

async function main() {
  await connectDatabase();
  const users = await migrateUsers();
  const authors = await migrateAuthors();
  const books = await migrateBooks();
  console.log(`GridFS migration complete. Users: ${users}, authors: ${authors}, PDFs/EPUBs: ${books.files}, covers: ${books.covers}`);
  console.log("Local files are intentionally kept until you verify the application. Remove them only after successful verification.");
}

main().catch(error => {
  console.error("GridFS media migration failed:", error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect().catch(() => {});
});
