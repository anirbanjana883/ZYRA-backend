import Loop from "../models/loop.model.js";
import uploadOnCloudinary from "../config/cloudinary.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { getSocketId, io } from "../socket.js";

// upload loop Controller
export const uploadLoop = async (req, res) => {
  try {
    const { caption } = req.body;

    let media;
    if (req.file) {
      media = await uploadOnCloudinary(req.file.path);
    } else {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const loop = await Loop.create({
      caption,
      media,
      author: req.userId,
    });

    const user = await User.findById(req.userId);
    user.loops.push(loop._id);
    await user.save();

    const populatedLoop = await Loop.findById(loop._id).populate(
      "author",
      "name userName profileImage"
    );

    //  (Realtime notification to followers on upload)
    const followers = await User.find({ following: req.userId }).select("_id");
    for (let follower of followers) {
      const notification = await Notification.create({
        sender: req.userId,
        receiver: follower._id,
        type: "upload",
        loop: loop._id,
        message: "uploaded a new loop",
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "name userName profileImage")
        .populate("receiver", "name userName profileImage")
        .populate("loop", "caption media");

      const receiverSocketId = getSocketId(follower._id.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newNotification", populatedNotification);
      }
    }
    // 

    return res.status(201).json(populatedLoop);
  } catch (err) {
    console.error("Error in uploadLoop:", err);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
};

// Get All loop
export const getAllLoops = async (req, res) => {
  try {
    const loops = await Loop.find({})
      .populate("author", "name userName profileImage") // loop author
      .populate("comments.author", "name userName profileImage") // comment authors
      .populate("comments.replies.author", "name userName profileImage") // reply authors
      .sort({ createdAt: -1 });

    return res.status(200).json(loops);
  } catch (error) {
    console.error("Get all loops error:", error);
    return res
      .status(500)
      .json({ message: `Get all loops error: ${error.message}` });
  }
};

// like/unlike loop with notifications (robust)
export const like = async (req, res) => {
  try {
    const loopId = req.params.loopId;
    const userId = req.userId?.toString();

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }

    const loop = await Loop.findById(loopId).populate(
      "author",
      "name userName profileImage"
    );

    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    const alreadyLiked = loop.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      loop.likes = loop.likes.filter((id) => id.toString() !== userId);
    } else {
      loop.likes.push(userId);

      // ✅ CHANGE START (Realtime notification for like)
      if (loop.author?._id.toString() !== userId) {
        try {
          const existingNotification = await Notification.findOne({
            sender: userId,
            receiver: loop.author._id,
            type: "like",
            loop: loop._id,
          });

          if (!existingNotification) {
            const notification = await Notification.create({
              sender: userId,
              receiver: loop.author._id,
              type: "like",
              loop: loop._id,
              message: "liked your loop",
            });

            const populatedNotification = await Notification.findById(
              notification._id
            )
              .populate("sender", "name userName profileImage")
              .populate("receiver", "name userName profileImage")
              .populate("loop", "caption media");

            const receiverSocketId = getSocketId(loop.author._id.toString());
            if (receiverSocketId) {
              io.to(receiverSocketId).emit(
                "newNotification",
                populatedNotification
              );
            }
          }
        } catch (notifErr) {
          console.error("Notification error:", notifErr);
        }
      }
      // 
    }

    await loop.save();

    // populate comments for frontend if needed
    await loop.populate("comments.author", "name userName profileImage");

    // emit like update to all sockets
    io.emit("likedLoop", {
      loopId: loop._id,
      likes: loop.likes,
    });

    return res.status(200).json(loop);
  } catch (error) {
    console.error("Like loop error:", error);
    return res
      .status(500)
      .json({ message: `Like loop error: ${error.message}` });
  }
};


// comment on loop (with notification)
export const comment = async (req, res) => {
  try {
    const { message } = req.body;
    const loopId = req.params.loopId;

    if (!message) {
      return res.status(400).json({ message: "Comment message is required" });
    }

    const loop = await Loop.findById(loopId).populate("author");
    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    loop.comments.push({
      author: req.userId,
      message: message.trim(),
    });
    // Realtime notification for comment
    if (loop.author._id.toString() !== req.userId.toString()) {
      const notification = await Notification.create({
        sender: req.userId,
        receiver: loop.author._id,
        type: "comment",
        loop: loop._id,
        message: "commented on your loop",
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "name userName profileImage")
        .populate("receiver", "name userName profileImage")
        .populate("loop", "caption media");

      const receiverSocketId = getSocketId(loop.author._id.toString());

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newNotification", populatedNotification);
      }
    }


    await loop.save();
    await loop.populate("author", "name userName profileImage");
    await loop.populate("comments.author", "name userName profileImage");
    await loop.populate("comments.replies.author", "name userName profileImage");

    io.emit("commentedLoop", {
      loopId: loop._id,
      comments: loop.comments,
    });

    return res.status(200).json(loop);
  } catch (error) {
    console.error("Comment in loop error:", error);
    return res
      .status(500)
      .json({ message: `Comment in loop error: ${error.message}` });
  }
};


// Reply to Comment

export const replyToComment = async (req, res) => {
  try {
    const { loopId, commentId } = req.params;
    let { message } = req.body;

    // Validate message
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Reply message cannot be empty" });
    }
    message = message.trim();

    // Find the loop
    const loop = await Loop.findById(loopId).populate("author");
    if (!loop) return res.status(404).json({ message: "Loop not found" });

    // Find the comment
    const comment = loop.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Add reply
    comment.replies.push({ author: req.userId, message: message.trim() });

    // Notify comment author if not self-reply
    if (comment.author.toString() !== req.userId.toString()) {
      const notification = await Notification.create({
        sender: req.userId,
        receiver: comment.author,
        type: "reply",
        loop: loop._id,
        message: "replied to your comment",
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "name userName profileImage")
        .populate("receiver", "name userName profileImage")
        .populate("loop", "caption media");

      const receiverSocketId = getSocketId(comment.author.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newNotification", populatedNotification);
      }
    }

    if (
      loop.author._id.toString() !== req.userId.toString() &&
      loop.author._id.toString() !== comment.author.toString()
    ) {
      const notification = await Notification.create({
        sender: req.userId,
        receiver: loop.author._id,
        type: "reply",
        loop: loop._id,
        message: "replied to a comment in your loop",
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "name userName profileImage")
        .populate("receiver", "name userName profileImage")
        .populate("loop", "caption media");

      const receiverSocketId = getSocketId(loop.author._id.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newNotification", populatedNotification);
      }
    }

    // Save loop and populate authors
    await loop.save();
    await loop.populate("comments.author", "name userName profileImage");
    await loop.populate("comments.replies.author", "name userName profileImage");

    // Emit reply update via socket
    io.emit("repliedLoop", {
      loopId: loop._id,
      commentId,
      replies: comment.replies,
    });

    return res.status(200).json(loop);
  } catch (error) {
    console.error("Reply in loop error:", error);
    return res.status(500).json({ message: `Reply in loop error: ${error.message}` });
  }
};

// Delete Comment
export const deleteComment = async (req, res) => {
  try {
    const { loopId, commentId } = req.params;

    const loop = await Loop.findById(loopId);
    if (!loop) return res.status(404).json({ message: "Loop not found" });

    const comment = loop.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // only author of comment or loop author can delete
    if (
      comment.author.toString() !== req.userId.toString() &&
      loop.author.toString() !== req.userId.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    comment.deleteOne();
    await loop.save();
    await loop.populate("comments.author", "name userName profileImage");
    await loop.populate(
      "comments.replies.author",
      "name userName profileImage"
    );

    io.emit("deletedLoopComment", { loopId: loop._id, commentId });

    return res.status(200).json({ message: "Comment deleted", loop });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: `Delete comment error: ${error.message}` });
  }
};

// Delete Reply
export const deleteReply = async (req, res) => {
  try {
    const { loopId, commentId, replyId } = req.params;

    const loop = await Loop.findById(loopId);
    if (!loop) return res.status(404).json({ message: "Loop not found" });

    const comment = loop.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    // only author of reply or loop author can delete
    if (
      reply.author.toString() !== req.userId.toString() &&
      loop.author.toString() !== req.userId.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    reply.deleteOne();
    await loop.save();
    await loop.populate("comments.author", "name userName profileImage");
    await loop.populate(
      "comments.replies.author",
      "name userName profileImage"
    );

    io.emit("deletedLoopReply", { loopId: loop._id, commentId, replyId });

    return res.status(200).json({ message: "Reply deleted", loop });
  } catch (error) {
    console.error("Delete reply error:", error);
    res.status(500).json({ message: `Delete reply error: ${error.message}` });
  }
};

// Delete Loop
export const deleteLoop = async (req, res) => {
  try {
    const { loopId } = req.params;
    const loop = await Loop.findById(loopId);

    if (!loop) return res.status(404).json({ message: "Loop not found" });

    // Only author can delete
    if (loop.author.toString() !== req.userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Remove loop from user's loops
    await User.findByIdAndUpdate(loop.author, {
      $pull: { loops: loop._id },
    });

    // Delete notifications related to this loop
    await Notification.deleteMany({ loop: loop._id });

    // Delete loop
    await loop.deleteOne();

    // Emit socket event
    io.emit("deletedLoop", { loopId: loop._id });

    res.status(200).json({ message: "Loop deleted successfully" });
  } catch (error) {
    console.error("Error deleting loop:", error);
    res.status(500).json({ message: "Server error" });
  }
};
