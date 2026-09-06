const mongoose = require("mongoose");

const authorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    bio: { type: String, default: "" },
    image: { type: String, default: "" },
    imageId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    birthDate: { type: Date },
    deathDate: { type: Date },
    birthPlace: { type: String, default: "" },
    nationality: { type: String, default: "" },
    occupation: { type: String, default: "" },
    website: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Author", authorSchema);
