import User from "../models/user.model.js";
import uploadOnCloudinary from "../config/cloudinary.js";
import Notification from "../models/notification.model.js";
import { getSocket } from "../socket.js";
import { io } from "../socket.js";



export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId)
      .select("-password")
      .populate([
        {
          path: "posts",
          populate: [
            { path: "author", select: "name userName profileImage" },
            { path: "comments.author", select: "name userName profileImage" },
          ],
        },
        {
          path: "saved",
          populate: [
            { path: "author", select: "name userName profileImage" },
            { path: "comments.author", select: "name userName profileImage" },
          ],
        },
        {
          path: "story",
          populate: [
            { path: "author", select: "name userName profileImage" },
            { path: "viewers", select: "name userName profileImage" }, // if you track viewers
          ],
        },
        { path: "followers", select: "name userName profileImage" },
        { path: "following", select: "name userName profileImage" },
      ]);

    if (!user) return res.status(400).json({ message: "User not found" });
    return res.status(200).json(user);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Get current user error: ${error.message}` });
  }
};

export const suggestedUser = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select(
      "-password"
    );
    return res.status(200).json(users);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Get suggested user error: ${error}` });
  }
};

export const editProfile = async (req, res) => {
  try {
    const { name, userName, bio, profession, gender } = req.body;
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Check for existing username (not belonging to current user)
    const sameUserWithUserName = await User.findOne({ userName }).select(
      "-password"
    );
    if (
      sameUserWithUserName &&
      sameUserWithUserName._id.toString() !== req.userId
    ) {
      return res.status(400).json({ message: "Username already taken" });
    }

    let profileImage;
    if (req.file) {
      profileImage = await uploadOnCloudinary(req.file.path);
    }

    user.name = name;
    user.userName = userName;
    if (profileImage) {
      user.profileImage = profileImage;
    }
    user.bio = bio;
    user.profession = profession;
    user.gender = gender;

    await user.save();
    return res.status(200).json(user);
  } catch (error) {
    console.error("Edit profile error:", error);
    return res.status(500).json({ message: `Edit profile error: ${error}` });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userName = req.params.userName;
    const user = await User.findOne({ userName })
      .select("-password")
      .populate([
        {
          path: "posts",
          populate: [
            { path: "author", select: "name userName profileImage" },
            { path: "comments.author", select: "name userName profileImage" },
          ],
        },
        { path: "followers", select: "name userName profileImage" },
        { path: "following", select: "name userName profileImage" },
      ]);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ message: `Get profile error: ${error}` });
  }
};

export const follow = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.targetUserId;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user not found" });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      //  Unfollow 
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== targetUserId
      );
      targetUser.followers = targetUser.followers.filter(
        (id) => id.toString() !== currentUserId
      );

      await currentUser.save();
      await targetUser.save();

      return res.status(200).json({
        following: false,
        message: "Unfollowed successfully",
      });
    } else {
      // Follow 
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);

      await currentUser.save();
      await targetUser.save();

      // Realtime Notification
      if (currentUserId !== targetUserId) {
        const notification = await Notification.create({
          sender: currentUser._id,
          receiver: targetUser._id,
          type: "follow",
          message: `${currentUser.name} started following you.`,
        });

        const populatedNotification = await Notification.findById(
          notification._id
        )
          .populate("sender", "name userName profileImage")
          .populate("receiver", "name userName profileImage");

        const receiverSocketId = getSocket(targetUserId.toString()); 
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newNotification", populatedNotification);
        }
      }

      return res.status(200).json({
        following: true,
        message: "Followed successfully",
      });
    }
  } catch (error) {
    return res.status(500).json({ message: `Follow error: ${error.message}` });
  }
};

export const followingList = async (req, res) => {
  try {
    const result = await User.findById(req.userId) 

    return res.status(200).json(result?.following);
  } catch (error) {
    console.error("Following list error:", error);
    return res.status(500).json({ message: `Following list error: ${error.message}` });
  }
};
// fuzzy search from mongo ab atlus 
export const search = async (req, res) => {
  try {
    const keyWord = req.query.keyWord;

    if (!keyWord) {
      return res.status(400).json({ message: "Keyword is required" });
    }

    const users = await User.aggregate([
      {
        $search: {
          index: "userSearchIndex", // your index name
          text: {
            query: keyWord,
            path: ["userName", "name"], // search in both fields
            fuzzy: { maxEdits: 1 } // allows small typos
          }
        }
      },
      {
        $project: {
          userName: 1,
          name: 1,
          profileImage: 1,
          followersCount: { $size: "$followers" },
          followingCount: { $size: "$following" }
        }
      },
      { $limit: 10 } // limit results
    ]);

    return res.status(200).json(users);
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      receiver: req.userId
    })
      .populate("sender", "name userName profileImage")
      .populate("receiver", "name userName profileImage")
      .populate("post")
      .populate("loop")
      .sort({ createdAt: -1 }); 

    return res.status(200).json(notifications);
  } catch (error) {
    return res.status(500).json({ message: "Notification Error" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.notificationId;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Security: ensure only the receiver can mark as read
    if (notification.receiver.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    notification.isRead = true;
    await notification.save(); 

    return res.status(200).json({ message: "Marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Read notification error" });
  }
};

export const getLastSeen = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("isOnline lastSeen");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
}

// Mark all notifications as read/seen
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { receiver: req.userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Error marking all as read" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      receiver: userId, 
    });

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting notification", error: err.message });
  }
};