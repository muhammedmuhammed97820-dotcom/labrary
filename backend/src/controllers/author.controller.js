const Author = require("../models/Author");

async function getAuthors(req, res) {

  try {

    const authors =
      await Author.find()
        .sort({ name: 1 });

    res.json(authors);

  } catch (error) {

    res.status(500).json({
      message: "Failed to load authors."
    });
  }
}

async function createAuthor(req, res) {

  try {

    const name =
      String(req.body.name || "").trim();

    if (!name) {

      return res.status(400).json({
        message: "Author name is required."
      });
    }

    const existing =
      await Author.findOne({
        name: {
          $regex: `^${escapeRegex(name)}$`,
          $options: "i"
        }
      });

    if (existing) {

      return res.status(200).json({
        message: "Author already exists.",
        author: existing
      });
    }

    const author =
      await Author.create({
        name,
        bio: req.body.bio || ""
      });

    res.status(201).json({
      message: "Author created.",
      author
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to create author."
    });
  }
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

module.exports = {
  getAuthors,
  createAuthor
};
