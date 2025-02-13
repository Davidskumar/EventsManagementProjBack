const express = require("express");
const Event = require("../models/Event");
const authMiddleware = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const multer = require("multer");

const router = express.Router();

// 🔹 Multer Storage Setup (for handling file uploads)
const storage = multer.diskStorage({});
const upload = multer({ storage });

// ✅ CREATE EVENT WITH IMAGE UPLOAD
router.post("/", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const io = req.app.get("io");
    const { title, description, date, category } = req.body;

    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }

    // 🔹 Upload image to Cloudinary (if an image is uploaded)
    let imageUrl = "";
    if (req.file) {
      const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
        folder: "event_images",
      });
      imageUrl = uploadResponse.secure_url;
    }

    // Create event with image URL
    const newEvent = new Event({
      title,
      description,
      date,
      category,
      imageUrl,
      createdBy: req.user.userId,
    });

    await newEvent.save();

    // Populate createdBy before emitting event
    const populatedEvent = await Event.findById(newEvent._id).populate("createdBy", "name email");

    io.emit("eventCreated", populatedEvent);
    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Error creating event" });
  }
});

// ✅ GET ALL EVENTS (Public)
router.get("/", async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name email")
      .populate("attendees", "name email"); // ✅ Populate attendees
    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Error fetching events" });
  }
});

// ✅ UPDATE EVENT (Protected)
router.put("/:id", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const io = req.app.get("io");
    let event = await Event.findById(req.params.id);

    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (req.file) {
      const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
        folder: "event_images",
      });
      event.imageUrl = uploadResponse.secure_url;
    }

    event.title = req.body.title || event.title;
    event.description = req.body.description || event.description;
    event.date = req.body.date || event.date;
    event.category = req.body.category || event.category;
    await event.save();

    const populatedEvent = await Event.findById(event._id)
      .populate("createdBy", "name email")
      .populate("attendees", "name email");

    io.emit("eventUpdated", populatedEvent);
    res.status(200).json(populatedEvent);
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: "Error updating event" });
  }
});

// ✅ DELETE EVENT (Protected)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const io = req.app.get("io");
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await event.deleteOne();

    io.emit("eventDeleted", req.params.id);
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Error deleting event" });
  }
});

// ✅ JOIN EVENT (RSVP)
router.post("/:id/join", authMiddleware, async (req, res) => {
  try {
    const io = req.app.get("io");
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.attendees.includes(req.user.userId)) {
      return res.status(400).json({ message: "You have already joined this event." });
    }

    event.attendees.push(req.user.userId);
    await event.save();

    const populatedEvent = await Event.findById(event._id)
      .populate("createdBy", "name email")
      .populate("attendees", "name email");

    io.emit("attendeeUpdated", populatedEvent);
    res.status(200).json(populatedEvent);
  } catch (error) {
    console.error("Error joining event:", error);
    res.status(500).json({ message: "Error joining event" });
  }
});

module.exports = router;
