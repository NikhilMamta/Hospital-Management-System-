import React, { useState, useEffect } from "react";
import { X, Camera, Send, User, MessageSquare, Loader2, UserPlus, UserCog } from "lucide-react";
import {
  getNursesForSelection,
  getRMOsForSelection,
  uploadNursePhoto,
  createCongratulationsPost,
} from "../../../api/congratulations";

const POST_TYPES = {
  nurse: {
    label: "Nurse",
    icon: <UserPlus size={16} />,
    color: "green",
    gradient: "from-green-600 to-emerald-600",
    hoverGradient: "from-green-500 to-emerald-500",
    ring: "focus:ring-green-500/20 focus:border-green-500",
    shadow: "shadow-green-500/20",
    activeBg: "bg-green-600 text-white",
    inactiveBg: "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    searchPlaceholder: "Search for a nurse...",
    staffLabel: "Target Nurse",
    photoLabel: "Nurse Photo (Optional)",
    title: "Nurse Appreciation Post",
    subtitle: "Recognise your nursing heroes",
    avatarBg: "bg-green-100",
    avatarColor: "text-green-600",
    dropdownHover: "hover:bg-green-50",
  },
  rmo: {
    label: "RMO",
    icon: <UserCog size={16} />,
    color: "indigo",
    gradient: "from-indigo-600 to-blue-600",
    hoverGradient: "from-indigo-500 to-blue-500",
    ring: "focus:ring-indigo-500/20 focus:border-indigo-500",
    shadow: "shadow-indigo-500/20",
    activeBg: "bg-indigo-600 text-white",
    inactiveBg: "bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    searchPlaceholder: "Search for an RMO...",
    staffLabel: "Target RMO",
    photoLabel: "RMO Photo (Optional)",
    title: "RMO Appreciation Post",
    subtitle: "Honour your resident medical officers",
    avatarBg: "bg-indigo-100",
    avatarColor: "text-indigo-600",
    dropdownHover: "hover:bg-indigo-50",
  },
};

export default function NewPostModal({ isOpen, onClose, onSuccess, userName, defaultPostType = "nurse" }) {
  const [postType, setPostType] = useState(defaultPostType);
  const [staffName, setStaffName] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [designation, setDesignation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const config = POST_TYPES[postType];

  useEffect(() => {
    if (!isOpen) return;
    setStaffList([]);
    setStaffName("");
    setDesignation("");
    setSearchTerm("");
    setShowDropdown(false);
    const fetcher = postType === "nurse" ? getNursesForSelection : getRMOsForSelection;
    fetcher().then(setStaffList).catch(console.error);
  }, [isOpen, postType]);

  // Reset form fields when postType changes
  const handleTypeChange = (type) => {
    setPostType(type);
    setStaffName("");
    setDesignation("");
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!staffName || !message) return;

    setIsSubmitting(true);
    try {
      let photo_url = null;
      if (file) {
        photo_url = await uploadNursePhoto(file);
      }

      await createCongratulationsPost({
        nurse_name: staffName,
        designation,
        message,
        photo_url,
        created_by: userName,
        post_type: postType,
      });

      onSuccess();
      onClose();
      // Reset form
      setStaffName("");
      setMessage("");
      setFile(null);
      setPreviewUrl(null);
      setSearchTerm("");
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredStaff = staffList.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-2xl rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`${config.iconBg} p-2.5 rounded-2xl`}>
                <MessageSquare className={`${config.iconColor} w-6 h-6`} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
                  {config.title}
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">
                  {config.subtitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
            >
              <X size={24} />
            </button>
          </div>

          {/* Post Type Toggle */}
          <div className="flex items-center gap-2 mb-6 bg-gray-50 rounded-2xl p-1">
            {Object.entries(POST_TYPES).map(([type, cfg]) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200 ${
                  postType === type ? cfg.activeBg + " shadow-md" : cfg.inactiveBg
                }`}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Staff Selection */}
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                {config.staffLabel}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder={config.searchPlaceholder}
                  className={`w-full bg-gray-50/50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all focus:ring-2 ${config.ring}`}
                  value={searchTerm || staffName}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />

                {showDropdown && filteredStaff.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto overflow-x-hidden">
                    {filteredStaff.map((member, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`w-full px-6 py-3 text-left transition-colors flex items-center gap-3 group ${config.dropdownHover}`}
                        onClick={() => {
                          setStaffName(member.name);
                          setDesignation(member.designation);
                          setSearchTerm(member.name);
                          setShowDropdown(false);
                        }}
                      >
                        <div
                          className={`w-8 h-8 rounded-full ${config.avatarBg} flex items-center justify-center ${config.avatarColor} font-black text-[10px] group-hover:scale-110 transition-transform`}
                        >
                          {member.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 leading-none">{member.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{member.designation}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && searchTerm && filteredStaff.length === 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 px-6 py-4 text-xs text-gray-400 font-bold uppercase tracking-widest">
                    No {config.label} found. You can still type a name manually.
                  </div>
                )}
              </div>
            </div>

            {/* Designation */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                Designation
              </label>
              <input
                type="text"
                placeholder={
                  postType === "nurse"
                    ? "e.g. OPD Attender, Staff Nurse..."
                    : "e.g. Resident Medical Officer, RMO..."
                }
                className={`w-full bg-gray-50/50 border border-gray-100 rounded-2xl py-4 px-4 text-sm font-bold outline-none transition-all focus:ring-2 ${config.ring}`}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                required
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                Your Message
              </label>
              <textarea
                placeholder="What would you like to say?..."
                className={`w-full bg-gray-50/50 border border-gray-100 rounded-3xl py-4 px-4 text-sm font-bold min-h-[120px] outline-none transition-all resize-none focus:ring-2 ${config.ring}`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                {config.photoLabel}
              </label>
              <div className="flex items-center gap-4">
                <div
                  className={`w-24 h-24 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden group hover:border-${config.color}-400 hover:bg-${config.color}-50`}
                  onClick={() => document.getElementById(`photo-upload-${postType}`).click()}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <>
                      <Camera className="text-gray-300 mb-1" size={20} />
                      <span className="text-[8px] font-black text-gray-400 uppercase">Upload</span>
                    </>
                  )}
                  <input
                    id={`photo-upload-${postType}`}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 font-bold leading-tight">
                    Add a photo to make the post more special. Files under 5MB supported.
                  </p>
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => { setFile(null); setPreviewUrl(null); }}
                      className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-2 hover:underline"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !staffName || !message}
              className={`w-full bg-gradient-to-r ${config.gradient} hover:${config.hoverGradient} text-white font-black py-4 px-6 rounded-2xl shadow-xl ${config.shadow} active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>PUBLISHING...</span>
                </>
              ) : (
                <>
                  <Send size={20} />
                  <span>PUBLISH POST</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
