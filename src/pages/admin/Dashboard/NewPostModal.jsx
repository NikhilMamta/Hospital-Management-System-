import React, { useState, useEffect } from "react";
import { X, Camera, Send, User, MessageSquare, Loader2 } from "lucide-react";
import { getNursesForSelection, uploadNursePhoto, createCongratulationsPost } from "../../../api/congratulations";

export default function NewPostModal({ isOpen, onClose, onSuccess, userName }) {
  const [nurseName, setNurseName] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [nurses, setNurses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch nurses for selection
      getNursesForSelection().then(setNurses).catch(console.error);
    }
  }, [isOpen]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nurseName || !message) return;

    setIsSubmitting(true);
    try {
      let photo_url = null;
      if (file) {
        photo_url = await uploadNursePhoto(file);
      }

      await createCongratulationsPost({
        nurse_name: nurseName,
        message,
        photo_url,
        created_by: userName,
      });

      onSuccess();
      onClose();
      // Reset form
      setNurseName("");
      setMessage("");
      setFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredNurses = nurses.filter(n => 
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2.5 rounded-2xl">
                <MessageSquare className="text-green-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Congratulations Post</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Spread the positivity</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nurse Selection */}
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Target Nurse</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Search for a nurse..."
                  className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                  value={searchTerm || nurseName}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                
                {showDropdown && filteredNurses.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto overflow-x-hidden">
                    {filteredNurses.map((nurse, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full px-6 py-3 text-left hover:bg-green-50 transition-colors flex items-center gap-3 group"
                        onClick={() => {
                          setNurseName(nurse.name);
                          setSearchTerm(nurse.name);
                          setShowDropdown(false);
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-black text-[10px] group-hover:scale-110 transition-transform">
                          {nurse.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 leading-none">{nurse.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{nurse.designation}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Your Message</label>
              <textarea
                placeholder="What would you like to say?..."
                className="w-full bg-gray-50/50 border border-gray-100 rounded-3xl py-4 px-4 text-sm font-bold min-h-[120px] focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nurse Photo (Optional)</label>
              <div className="flex items-center gap-4">
                <div 
                  className="w-24 h-24 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all relative overflow-hidden group"
                  onClick={() => document.getElementById('photo-upload').click()}
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <>
                      <Camera className="text-gray-300 mb-1" size={20} />
                      <span className="text-[8px] font-black text-gray-400 uppercase">Upload</span>
                    </>
                  )}
                  <input
                    id="photo-upload"
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
                      onClick={() => {setFile(null); setPreviewUrl(null);}}
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
              disabled={isSubmitting || !nurseName || !message}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
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
