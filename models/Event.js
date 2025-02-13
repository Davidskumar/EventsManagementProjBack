const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    category: { type: String, required: true, enum: ["Conference", "Workshop", "Meetup"] }, // ✅ New category field
    imageUrl: { type: String, default: "" }, // 🔹 Store Cloudinary image URL
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ✅ Associate event with a user
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", EventSchema);
