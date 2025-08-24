import User from "../models/user.model.js";
import uploadOnCloudinary from "../config/cloudinary.js";

// export const getCurrentUser = async (req, res) => {
//   try {
//     const userId = req.userId;
//     const user = await User.findById(userId)
//     .populate("posts loops posts.author posts.comments saved saved.author")
//     .select("-password");
//     if (!user) {
//       return res.status(400).json({ message: "User not found" });
//     }
//     return res.status(200).json(user);
//   } catch (error) {
//     return res.status(500).json({ message: `Get current user error: ${error}` });
//   }
// };


// controllers/user.controller.js
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
    return res.status(500).json({ message: `Get current user error: ${error.message}` });
  }
};


export const suggestedUser = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select("-password");
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: `Get suggested user error: ${error}` });
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
    const sameUserWithUserName = await User.findOne({ userName }).select("-password");
    if (sameUserWithUserName && sameUserWithUserName._id.toString() !== req.userId) {
      return res.status(400).json({ message: `User already exists: ${error}` });
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
    const user = await User.findOne({ userName }).select("-password")
    .populate("posts loops followers following")
    
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
      // Unfollow
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== targetUserId
      );
      targetUser.followers = targetUser.followers.filter(
        id => id.toString() !== currentUserId
      );

      await currentUser.save();
      await targetUser.save();

      return res.status(200).json({
        following: false,
        message: "Unfollowed successfully"
      });
    } else {
      // Follow
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);

      await currentUser.save();
      await targetUser.save();

      return res.status(200).json({
        following: true,
        message: "Followed successfully"
      });
    }
  } catch (error) {
    return res.status(500).json({ message: `Follow error: ${error.message}` });
  }
};
