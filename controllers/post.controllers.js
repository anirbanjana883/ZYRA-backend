import uploadOnCloudinary from "../config/cloudinary.js";
import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { getSocketId, io } from "../socket.js";

// Upload Post Controller
export const uploadPost = async (req, res) => {
  try {
    const { caption, mediaType } = req.body;
    let media;
    if (req.file) {
      media = await uploadOnCloudinary(req.file.path);
    } else {
      res.status(400).json({ error: "No file uploaded" });
    }
    const post = await Post.create({
      caption,
      media,
      mediaType,
      author: req.userId,
    });

    const populatedPost = await Post.findById(post._id).populate(
      "author",
      "name userName profileImage"
    );

    return res.status(201).json(populatedPost);
  } catch (err) {
    console.error("Error in uploadPost:", err);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
};

// Get All Posts for Logged In User
export const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find({})
      .populate("author", "name userName profileImage")
      .populate("comments.author", "name userName profileImage")
      .populate("comments.replies.author", "name userName profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json(posts);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Get all posts error: ${error.message}` });
  }
};


// Like/Unlike Post
export const like = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.userId.toString();

    const post = await Post.findById(postId).populate("author");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(userId);

      //  notification only if not self-like
      if (post.author._id.toString() !== userId) {
        const existingNotification = await Notification.findOne({
          sender: userId,
          receiver: post.author._id,
          type: "like",
          post: post._id,
        });

        if (!existingNotification) {
          const notification = await Notification.create({
            sender: userId,
            receiver: post.author._id,
            type: "like",
            post: post._id,
            message: "liked your post",
          });

          const populatedNotification = await Notification.findById(
            notification._id
          )
            .populate("sender", "name userName profileImage")
            .populate("receiver", "name userName profileImage")
            .populate("post", "caption media mediaType");

          const receiverSocketId = getSocketId(post.author._id.toString());

          if (receiverSocketId) {
            io.to(receiverSocketId).emit(
              "newNotification",
              populatedNotification
            );
          }
        }
      }
    }

    await post.save();
    await post.populate([
      { path: "author", select: "name userName profileImage" },
      { path: "comments.author", select: "name userName profileImage" },
      { path: "comments.replies.author", select: "name userName profileImage" }, // ⭐ UPDATED
    ]);

    io.emit("likedPost", {
      postId: post._id,
      likes: post.likes,
    });

    return res.status(200).json(post);
  } catch (error) {
    console.error("Like post error:", error);
    return res
      .status(500)
      .json({ message: `Like post error: ${error.message}` });
  }
};


// Comment on Post
export const comment = async (req, res) => {
  try {
    const { message } = req.body;
    const postId = req.params.postId;

    if (!message) {
      return res.status(400).json({ message: "Comment message is required" });
    }

    const post = await Post.findById(postId).populate("author");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    post.comments.push({
      author: req.userId,
      message,
    });

    //  notification only if not self-comment
    if (post.author._id.toString() !== req.userId.toString()) {
      const notification = await Notification.create({
        sender: req.userId,
        receiver: post.author._id,
        type: "comment",
        post: post._id,
        message: "commented on your post",
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "name userName profileImage")
        .populate("receiver", "name userName profileImage")
        .populate("post", "caption media mediaType");

      const receiverSocketId = getSocketId(post.author._id.toString());

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newNotification", populatedNotification);
      }
    }

    await post.save();
    await post.populate([
      { path: "author", select: "name userName profileImage" },
      { path: "comments.author", select: "name userName profileImage" },
      { path: "comments.replies.author", select: "name userName profileImage" }, // ⭐ UPDATED
    ]);

    io.emit("commentedPost", {
      postId: post._id,
      comments: post.comments,
    });

    return res.status(200).json(post);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Comment in post error: ${error.message}` });
  }
};

// Save / Unsave Post

export const savedPosts = async (req, res) => {
  try {
    const postId = req.params.postId;
    const user = await User.findById(req.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    const alreadySaved = user.saved.some(id => id.toString() === postId.toString());

    if (alreadySaved) {
      user.saved = user.saved.filter(id => id.toString() !== postId.toString());
    } else {
      user.saved.push(postId);
    }

    await user.save();

    // Return the FULL updated user, with saved posts and their authors populated
    const updatedUser = await User.findById(req.userId)
      .select("-password")
      .populate([
        {
          path: "saved",
          populate: [
            { path: "author", select: "name userName profileImage" },
            { path: "comments.author", select: "name userName profileImage" },
            { path: "comments.replies.author", select: "name userName profileImage" }, 
          ],
        },
        { path: "followers", select: "name userName profileImage" },
        { path: "following", select: "name userName profileImage" },
        {
          path: "posts",
          populate: [
            { path: "author", select: "name userName profileImage" },
            { path: "comments.author", select: "name userName profileImage" },
            { path: "comments.replies.author", select: "name userName profileImage" }, 
          ],
        },
      ]);


    return res.status(200).json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: `Save post error: ${error.message}` });
  }
};


// ⭐ Reply to a Comment
export const replyToComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Reply message is required" });
    }

    const post = await Post.findById(postId).populate("author");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({
      author: req.userId,
      message,
    });

    await post.save();
    await post.populate([
      { path: "author", select: "name userName profileImage" },
      { path: "comments.author", select: "name userName profileImage" },
      { path: "comments.replies.author", select: "name userName profileImage" },
    ]);

    io.emit("repliedComment", {
      postId: post._id,
      comments: post.comments,
    });

    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ message: `Reply error: ${error.message}` });
  }
};

// ⭐ Delete Comment
export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // only author of comment or post author can delete
    if (
      comment.author.toString() !== req.userId.toString() &&
      post.author.toString() !== req.userId.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    comment.deleteOne(); // remove comment
    await post.save();

    // 🔥 Re-fetch with population so frontend always gets full post data
    const updatedPost = await Post.findById(postId)
      .populate("author", "userName profileImage")
      .populate("comments.author", "userName profileImage")
      .populate("comments.replies.author", "userName profileImage");

    io.emit("deletedComment", { postId: post._id, commentId });

    res.status(200).json(updatedPost); // ✅ send updated post
  } catch (error) {
    res.status(500).json({ message: `Delete comment error: ${error.message}` });
  }
};


// ⭐ Delete Reply
export const deleteReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    // only author of reply or post author can delete
    if (
      reply.author.toString() !== req.userId.toString() &&
      post.author.toString() !== req.userId.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    reply.deleteOne();
    await post.save();

    // 🔥 Re-fetch with population for safe frontend rendering
    const updatedPost = await Post.findById(postId)
      .populate("author", "userName profileImage")
      .populate("comments.author", "userName profileImage")
      .populate("comments.replies.author", "userName profileImage");

    io.emit("deletedReply", { postId: post._id, commentId, replyId });

    res.status(200).json(updatedPost); // ✅ send fully populated updated post
  } catch (error) {
    res.status(500).json({ message: `Delete reply error: ${error.message}` });
  }
};
