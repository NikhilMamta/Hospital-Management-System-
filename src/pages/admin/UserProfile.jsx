import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import supabase from "../../SupabaseClient";
import {
  User,
  Mail,
  Shield,
  Edit2,
  Save,
  X,
  Camera,
  Upload,
  Check,
} from "lucide-react";

const UserProfile = () => {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    profile_image: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        profile_image: user.image || "",
      });
    }
  }, [user]);

  // Step 5: Debug (Temporary)
  console.log("USER DATA:", user);

  // Step 1: Fetch Fresh User from DB (Mandatory)
  useEffect(() => {
    const fetchUserFromDB = async () => {
      if (!user?.username) return;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_name", user.username)
        .single();

      if (!error && data) {
        const formattedUser = {
          ...data,
          id: data.id || data.user_name,
          username: data.user_name,
          name: data.name || data.user_name,
          email: data.email || `${data.user_name}@hms.com`,
          image:
            data.profile_image ||
            (data.role === "admin"
              ? "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600"
              : "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600"),
        };
        setUser(formattedUser);
        localStorage.setItem("mis_user", JSON.stringify(formattedUser));
      }
    };

    fetchUserFromDB();
  }, [user?.username, setUser]);

  const uploadImageToSupabase = async (file) => {
    try {
      // Create a unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage bucket 'profile_image'
      const { error: uploadError } = await supabase.storage
        .from("profile_image")
        .upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist, try to create it
        if (
          uploadError.message.includes("bucket") &&
          uploadError.message.includes("not found")
        ) {
          throw new Error(
            'Please create a "profile_image" bucket in Supabase Storage first.',
          );
        }
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from("profile_image")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading image to Supabase:", error);
      throw error;
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors({ image: "File size must be less than 2MB" });
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrors({ image: "Please upload an image file" });
      return;
    }

    // Store the file for later upload
    setImageFile(file);

    // Create a preview URL for display
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        profile_image: reader.result, // This is a data URL for preview
      }));
      setErrors((prev) => ({ ...prev, image: "" }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setFormData((prev) => ({
      ...prev,
      profile_image: user.image || "",
    }));
    setErrors((prev) => ({ ...prev, image: "" }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // If a new image is selected, upload it first
      let profileImageUrl = formData.profile_image;
      if (imageFile) {
        setUploading(true);
        try {
          profileImageUrl = await uploadImageToSupabase(imageFile);
          if (!profileImageUrl) {
            setUploading(false);
            setLoading(false);
            return;
          }
        } catch (error) {
          setUploading(false);
          setLoading(false);
          setErrors({
            general:
              error.message || "Failed to upload image. Please try again.",
          });
          return;
        }
        setUploading(false);
      }

      // Update user in database
      const { error } = await supabase
        .from("users")
        .update({
          name: formData.name,
          profile_image: profileImageUrl,
        })
        .eq("user_name", user.username);

      if (error) throw error;

      // Also update the all_staff table if there's a matching record
      try {
        const { error: staffError } = await supabase
          .from("all_staff")
          .update({
            name: formData.name,
          })
          .eq("id", user.id);

        // Don't throw error if no matching record in all_staff (user might not be in all_staff)
        if (staffError && !staffError.message.includes("No rows found")) {
          console.warn("Could not update all_staff table:", staffError);
        }
      } catch (staffUpdateError) {
        console.warn("Could not update all_staff table:", staffUpdateError);
      }

      // Update local user state
      // Step 2: Fetch Fresh Data after Save (Important)
      const { data: updatedData, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("user_name", user.username)
        .single();

      if (fetchError) throw fetchError;

      const formattedUser = {
        ...updatedData,
        id: updatedData.id || updatedData.user_name,
        username: updatedData.user_name,
        name: updatedData.name || updatedData.user_name,
        email: updatedData.email || `${updatedData.user_name}@hms.com`,
        image:
          updatedData.profile_image ||
          (updatedData.role === "admin"
            ? "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600"
            : "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600"),
      };

      setUser(formattedUser);
      localStorage.setItem("mis_user", JSON.stringify(formattedUser));

      setIsEditing(false);
      setImageFile(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      setErrors({ general: "Failed to update profile. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name || "",
      profile_image: user.image || "",
    });
    setImageFile(null);
    setErrors({});
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl p-6 mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Edit2 size={16} />
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {loading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white transition-colors bg-gray-600 rounded-lg hover:bg-gray-700"
                >
                  <X size={16} />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {errors.general && (
            <div className="p-3 mb-4 text-red-700 border border-red-200 rounded-lg bg-red-50">
              {errors.general}
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Profile Image */}
            <div className="flex flex-col items-center md:col-span-2">
              <div className="relative">
                <img
                  src={
                    formData.profile_image ||
                    "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600"
                  }
                  alt={user.name}
                  className="object-cover w-32 h-32 border-4 border-gray-200 rounded-full"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src =
                      "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600";
                  }}
                />
                {isEditing && (
                  <button className="absolute bottom-0 right-0 p-2 text-white transition-colors bg-blue-600 rounded-full hover:bg-blue-700">
                    <Camera size={16} />
                  </button>
                )}
              </div>
              {isEditing && (
                <div className="w-full max-w-md mt-4">
                  <div className="space-y-3">
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      Profile Image
                    </label>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center justify-center gap-2 px-4 py-3 transition-colors border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50">
                        <Upload size={20} className="text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {uploading ? "Uploading..." : "Choose Profile Image"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>
                      <p className="text-xs text-center text-gray-500">
                        Recommended: Square image, JPG or PNG, max 2MB
                      </p>
                      {imageFile && (
                        <div className="p-3 text-sm text-blue-600 border border-blue-200 rounded bg-blue-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Check size={16} />
                              <span>Selected: {imageFile.name}</span>
                            </div>
                            <button
                              onClick={handleRemoveImage}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-blue-500">
                            Image will be uploaded when you save your profile
                          </p>
                        </div>
                      )}
                      {errors.image && (
                        <p className="text-sm text-red-600">{errors.image}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Details */}
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="flex items-center gap-2 mb-1 text-sm font-medium text-gray-700">
                  <User size={16} />
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.name ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="Enter your full name"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{user.name}</p>
                )}
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Username */}
              <div>
                <label className="flex items-center gap-2 mb-1 text-sm font-medium text-gray-700">
                  <User size={16} />
                  Username
                </label>
                <p className="font-medium text-gray-900">
                  {user.username || user.user_name}
                </p>
                <p className="text-sm text-gray-500">
                  Username cannot be changed
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center gap-2 mb-1 text-sm font-medium text-gray-700">
                  <Mail size={16} />
                  Email Address
                </label>
                <p className="font-medium text-gray-900">
                  {user.email || "No Email Found"}
                </p>
                <p className="text-sm text-gray-500">
                  Email is auto-generated from username
                </p>
              </div>
            </div>

            {/* Role and Permissions */}
            <div className="space-y-6">
              {/* Role */}
              <div>
                <label className="flex items-center gap-2 mb-1 text-sm font-medium text-gray-700">
                  <Shield size={16} />
                  Role
                </label>
                <p className="font-medium text-gray-900 capitalize">
                  {user.role}
                </p>
                <p className="text-sm text-gray-500">
                  Role is assigned by administrator
                </p>
              </div>

              {/* User ID */}
              <div>
                <label className="flex items-center gap-2 mb-1 text-sm font-medium text-gray-700">
                  <User size={16} />
                  User ID
                </label>
                <p className="font-medium text-gray-900">{user.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
