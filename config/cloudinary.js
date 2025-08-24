import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const uploadOnCloudinary = async (file) => {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_SECRET,
    });

    if (!file) return null;

    const result = await cloudinary.uploader.upload(file, {
      resource_type: "auto",
    });

    fs.unlinkSync(file); 
    return result.secure_url;
  } catch (error) {
    if (file && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.error("Failed to delete local file:", err);
      }
    }

    console.error("Cloudinary upload failed:", error);
    return null;
  }
};

export default uploadOnCloudinary;
