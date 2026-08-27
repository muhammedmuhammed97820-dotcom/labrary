const Author = require("../models/Author");
const Category = require("../models/Category");

async function findOrCreateAuthor(name) {

  const cleanName =
    String(name || "").trim();

  if (!cleanName) {
    throw new Error("Author name is required.");
  }

  let author =
    await Author.findOne({
      name: {
        $regex: `^${escapeRegex(cleanName)}$`,
        $options: "i"
      }
    });

  if (!author) {

    author =
      await Author.create({
        name: cleanName
      });
  }

  return author;
}

async function findOrCreateCategory(name) {

  const cleanName =
    String(name || "").trim();

  if (!cleanName) {
    throw new Error("Category name is required.");
  }

  let category =
    await Category.findOne({
      name: {
        $regex: `^${escapeRegex(cleanName)}$`,
        $options: "i"
      }
    });

  if (!category) {

    category =
      await Category.create({
        name: cleanName
      });
  }

  return category;
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

module.exports = {
  findOrCreateAuthor,
  findOrCreateCategory
};
