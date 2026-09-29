import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  Download,
  Eye,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Maximize2,
} from "lucide-react";
import { uploadAyushmanPhotos, deleteAyushmanPhoto, formatISTDateTime } from "../../../api/ayushman";

/**
 * AyushmanPhotosModal
 * Allows doctors and authorized staff to view, upload up to 20 photos per patient row,
 * preview thumbnails, zoom full screen, and delete erroneous images from the `ayushman_photos` bucket.
 */
const AyushmanPhotosModal = ({
  isOpen,
  onClose,
  patient,
  onPhotosUpdated,
}) => {
  const [photos, setPhotos] = useState(patient?.photos || []);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deletingPath, setDeletingPath] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen || !patient) return null;

  const currentCount = photos.length;
  const remainingSlots = Math.max(0, 20 - currentCount);

  const handleFilesSelected = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > remainingSlots) {
      setErrorMsg(
        `Cannot upload ${selectedFiles.length} photos. Maximum is 20 photos (you have ${currentCount}, only ${remainingSlots} remaining).`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const updatedList = await uploadAyushmanPhotos({
        admissionNo: patient.admission_no,
        ipdAdmissionId: patient.ipd_admission_id,
        files: selectedFiles,
        currentPhotos: photos,
      });

      setPhotos(updatedList);
      setSuccessMsg(`Successfully uploaded ${selectedFiles.length} photo(s)!`);
      if (onPhotosUpdated) onPhotosUpdated(patient.admission_no, updatedList);
    } catch (err) {
      console.error("Upload failed:", err);
      setErrorMsg(err.message || "Failed to upload photos.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (photo) => {
    if (!window.confirm(`Are you sure you want to delete "${photo.name || "this photo"}"?`)) {
      return;
    }

    setDeletingPath(photo.path);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const updatedList = await deleteAyushmanPhoto({
        admissionNo: patient.admission_no,
        ipdAdmissionId: patient.ipd_admission_id,
        photoPath: photo.path,
        currentPhotos: photos,
      });

      setPhotos(updatedList);
      setSuccessMsg("Photo deleted successfully.");
      if (onPhotosUpdated) onPhotosUpdated(patient.admission_no, updatedList);
    } catch (err) {
      console.error("Delete failed:", err);
      setErrorMsg(err.message || "Failed to delete photo.");
    } finally {
      setDeletingPath(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center p-3 sm:p-6">
        <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-lg text-white">Patient Ayushman Photos</h3>
                  <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded-full border border-slate-700 font-mono">
                    {patient.admission_no}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Patient: <span className="text-white font-medium">{patient.patient_name}</span> • Ward:{" "}
                  <span className="text-slate-300">{patient.ward_number}</span> • Bed:{" "}
                  <span className="text-slate-300">{patient.bed_number}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold border ${
                  currentCount >= 20
                    ? "bg-amber-950/80 text-amber-300 border-amber-600"
                    : "bg-emerald-950/80 text-emerald-300 border-emerald-600"
                }`}
              >
                {currentCount} / 20 Photos
              </span>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 text-xs text-red-700 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 shrink-0 text-red-600" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-800 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2 shrink-0 text-emerald-600" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
            {/* Upload Area */}
            {currentCount < 20 ? (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-5 hover:border-emerald-500 transition-colors text-center group">
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  ref={fileInputRef}
                  onChange={handleFilesSelected}
                  disabled={uploading}
                  className="hidden"
                  id="ayushman-file-upload-input"
                />
                <label
                  htmlFor="ayushman-file-upload-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-slate-800">
                      {uploading ? "Uploading images to bucket..." : "Click or Drag & Drop to Upload Photos"}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      You can select multiple images ({remainingSlots} slot{remainingSlots > 1 ? "s" : ""} remaining)
                    </p>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-md bg-slate-100 text-[11px] font-medium text-slate-600 border border-slate-200">
                    Supports JPG, PNG, WEBP, PDF (Max 20 per patient)
                  </span>
                </label>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-xs text-amber-800 font-medium">
                Maximum 20 photos uploaded for this patient. To add new ones, please delete an existing photo.
              </div>
            )}

            {/* Gallery Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Uploaded Photos ({currentCount})
                </h4>
                {currentCount > 0 && (
                  <span className="text-xs text-slate-400">
                    Click any thumbnail to view full resolution
                  </span>
                )}
              </div>

              {photos.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                  <ImageIcon className="w-12 h-12 mx-auto stroke-1 mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No photos uploaded yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Upload clinical documents, Ayushman cards, or procedure photos above
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {photos.map((photo, index) => {
                    const isDeleting = deletingPath === photo.path;
                    return (
                      <div
                        key={photo.id || photo.path || index}
                        className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
                      >
                        {/* Image Preview Container */}
                        <div
                          onClick={() => setLightboxImage(photo)}
                          className="relative aspect-4/3 bg-slate-100 overflow-hidden cursor-pointer flex items-center justify-center"
                        >
                          <img
                            src={photo.url}
                            alt={photo.name || "Patient photo"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23ccc' viewBox='0 0 24 24'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 text-white">
                            <span className="p-1.5 bg-black/60 rounded-full hover:bg-black/80">
                              <Maximize2 className="w-4 h-4" />
                            </span>
                          </div>
                          <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            #{index + 1}
                          </span>
                        </div>

                        {/* Card Info & Actions */}
                        <div className="p-2.5 flex-1 flex flex-col justify-between text-xs bg-white">
                          <div className="truncate font-semibold text-slate-800" title={photo.name}>
                            {photo.name || `Photo ${index + 1}`}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {formatISTDateTime(photo.uploaded_at)}
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <a
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="text-slate-500 hover:text-blue-600 flex items-center text-[11px] font-medium"
                              title="Download photo"
                            >
                              <Download className="w-3.5 h-3.5 mr-1" /> Save
                            </a>
                            <button
                              onClick={() => handleDelete(photo)}
                              disabled={isDeleting}
                              className="text-red-500 hover:text-red-700 flex items-center text-[11px] font-medium disabled:opacity-50"
                              title="Delete photo"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Storage bucket: <strong className="font-mono text-slate-700">ayushman_photos</strong></span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-xs transition-colors shadow-xs"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Fullscreen Preview */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="absolute top-4 right-4 flex items-center space-x-3 text-white">
            <a
              href={lightboxImage.url}
              download
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
              title="Download image"
            >
              <Download className="w-5 h-5 text-white" />
            </a>
            <button
              onClick={() => setLightboxImage(null)}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div
            className="max-w-4xl max-h-[85vh] p-2 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <p className="text-white text-xs mt-3 font-medium bg-black/60 px-3 py-1 rounded-full">
              {lightboxImage.name} • {formatISTDateTime(lightboxImage.uploaded_at)}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AyushmanPhotosModal;
