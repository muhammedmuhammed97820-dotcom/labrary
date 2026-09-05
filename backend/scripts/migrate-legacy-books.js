require("dotenv").config();

const mongoose = require("mongoose");
const connectDatabase = require("../src/config/database");
const Book = require("../src/models/Book");
const User = require("../src/models/user.model");

async function migrateLegacyBooks() {
  await connectDatabase();

  const admin = await User.findOne({ role: "admin" }).select("_id name email");

  if (!admin) {
    throw new Error("No admin user was found. Migration was not performed.");
  }

  const legacyFilter = {
    $and: [
      {
        $or: [
          { submittedBy: { $exists: false } },
          { submittedBy: null }
        ]
      },
      {
        $or: [
          { status: { $exists: false } },
          { status: null }
        ]
      }
    ]
  };

  const result = await Book.updateMany(
    legacyFilter,
    {
      $set: {
        submittedBy: admin._id,
        status: "approved",
        reviewedAt: new Date(),
        rejectionReason: ""
      }
    }
  );

  console.log("============================================");
  console.log(" LEGACY BOOK MIGRATION");
  console.log(` Admin: ${admin.name} (${admin.email})`);
  console.log(` Migrated books: ${result.modifiedCount}`);
  console.log(" Legacy books are now approved and linked to the admin.");
  console.log("============================================");
}

migrateLegacyBooks()
  .catch((error) => {
    console.error("Legacy book migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
