import User from "../models/user.model.js";
import Story from "../models/story.model.js";
import uploadOnCloudinary from "../config/cloudinary.js";

// Upload a story (only one story per user)
export const uploadStory = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    // Delete old story if it exists
    if (user.story) {
      await Story.findByIdAndDelete(user.story);
      user.story = null;
    }

    const { mediaType } = req.body;

    let media;
    if (req.file) {
      media = await uploadOnCloudinary(req.file.path);
    } else {
      return res.status(400).json({ message: "Please upload a file" });
    }

    // Create new story
    const story = await Story.create({
      author: req.userId,
      mediaType,
      media,
    });

    // Save reference in user
    user.story = story._id;
    await user.save();

    const populatedStory = await Story.findById(story._id)
      .populate("author", "name userName profileImage")
      .populate("viewers", "name userName profileImage");

    return res.status(201).json(populatedStory);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Error uploading story: ${error.message}` });
  }
};

export const viewStory = async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    // don't count author's own view
    if (story.author.toString() === req.userId.toString()) {
      return res.status(200).json(story); // return as is
    }
    // A viewer's ID will be stored only once
    const viewersIds = story.viewers.map((id) => id.toString());

    if (!viewersIds.includes(req.userId.toString())) {
      story.viewers.push(req.userId);
      await story.save();
    }

    const populatedStory = await Story.findById(story._id).populate([
      { path: "author", select: "name userName profileImage" },
      { path: "viewers", select: "name userName profileImage" },
    ]);

    return res.status(200).json(populatedStory);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Error viewing story: ${error.message}` });
  }
};

export const getStoryByUserName = async (req, res) => {
  try {
    const userName = req.params.userName;

    const user = await User.findOne({ userName });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const story = await Story.findOne({ author: user._id })
      .populate("author", "name userName profileImage")
      .populate("viewers", "name userName profileImage");

    if (!story) {
      return res.status(200).json(null);
    }

    return res.status(200).json(story);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Error fetching story by username: ${error.message}` });
  }
};

export const getAllStories = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const followingIds = currentUser.following;

    // include current user's ID too
    // Include both current user's story + followed users' stories
    const stories = await Story.find({
      author: { $in: [...followingIds, currentUser._id] },
      media: { $exists: true, $ne: null },
    })

      .populate("author", "name userName profileImage")
      .populate("viewers", "name userName profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json(stories);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Error fetching all stories: ${error.message}` });
  }
};

// Delete Story
export const deleteStory = async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    // only author can delete
    if (story.author.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this story" });
    }

    await Story.findByIdAndDelete(storyId);

    // remove reference from user
    const user = await User.findById(req.userId);
    if (user && user.story?.toString() === storyId.toString()) {
      user.story = null;
      await user.save();
    }

    return res.status(200).json({ message: "Story deleted successfully", storyId });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Error deleting story: ${error.message}` });
  }
};
