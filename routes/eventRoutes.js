const express = require("express");
const Event = require("../models/Event");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ CREATE EVENT (Protected)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const io = req.app.get("io");
    const { title, description, date } = req.body;

    // Create new event
    const newEvent = new Event({ title, description, date, createdBy: req.user.userId });
    await newEvent.save();

    // Populate createdBy before emitting event
    const populatedEvent = await Event.findById(newEvent._id).populate("createdBy", "name email");

    if (!populatedEvent.createdBy) { // Prevent emitting an event without a creator
      return res.status(500).json({ message: "Error: CreatedBy is missing" });
    }

    io.emit("eventCreated", populatedEvent); // Emit to all clients
    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Error creating event" });
  }
});

// ✅ GET ALL EVENTS (Public)
router.get("/", async (req, res) => {
  try {
    // Populate the createdBy field with user name and email
    const events = await Event.find().populate("createdBy", "name email");
    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Error fetching events" });
  }
});

// ✅ UPDATE EVENT (Protected)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const io = req.app.get("io");
    let event = await Event.findById(req.params.id);

    if (!event) return res.status(404).json({ message: "Event not found" });

    // Ensure only the creator can update
    if (event.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Update event details
    event.title = req.body.title || event.title;
    event.description = req.body.description || event.description;
    event.date = req.body.date || event.date;
    await event.save();

    // Fetch updated event and populate createdBy field
    const populatedEvent = await Event.findById(event._id).populate("createdBy", "name email");

    if (!populatedEvent.createdBy) {
      return res.status(500).json({ message: "Error: CreatedBy is missing" });
    }

    io.emit("eventUpdated", populatedEvent); // Emit update to all clients
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

    // Ensure only the creator can delete
    if (event.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await event.deleteOne();

    io.emit("eventDeleted", req.params.id); // Notify all clients
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Error deleting event" });
  }
});

module.exports = router;
