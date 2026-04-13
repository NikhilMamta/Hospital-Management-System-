import React from "react";
import { Trophy, Clock, Quote, Sparkles, Heart, Trash2 } from "lucide-react";
import { deleteCongratulationsPost } from "../../../api/congratulations";
import { useQueryClient } from "@tanstack/react-query";

export default function CongratulationsFeed({ posts, isLoading, isAdmin }) {
  const queryClient = useQueryClient();

  // Show only the latest post
  const latestPost = posts && posts.length > 0 ? posts[0] : null;

  // SMART TIMER: Local expiry without DB polling
  React.useEffect(() => {
    if (!latestPost) return;

    const createdAt = new Date(latestPost.created_at).getTime();
    const expiryTime = createdAt + 24 * 60 * 60 * 1000; // Created + 24 hours
    const now = Date.now();
    const msUntilExpiry = expiryTime - now;

    if (msUntilExpiry > 0) {
      // Set a one-time timer to refresh the UI only when this specific post expires
      const timer = setTimeout(() => {
        queryClient.invalidateQueries(['congratulations-posts']);
      }, msUntilExpiry + 1000); // Add a 1s buffer

      return () => clearTimeout(timer);
    } else {
      // If the post is already expired but somehow showed up, invalidate it
      queryClient.invalidateQueries(['congratulations-posts']);
    }
  }, [latestPost, queryClient]);

  const handleDelete = async () => {
    if (!latestPost || !window.confirm("Are you sure you want to remove this celebration?")) return;

    try {
      await deleteCongratulationsPost(latestPost.id);
      queryClient.invalidateQueries(['congratulations-posts']);
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post.");
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 bg-gray-50 animate-pulse rounded-[3rem]"></div>
    );
  }

  if (!latestPost) {
    // Only admins see the empty state to prompt them to post
    if (!isAdmin) return null;

    return (
      <div className="bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
          <Trophy className="text-gray-200" size={40} />
        </div>
        <p className="text-lg font-black text-gray-400 uppercase tracking-widest leading-none">Wall of Praise is Empty</p>
        <p className="text-xs text-gray-300 font-bold uppercase tracking-tight mt-2">Nominate a nurse to see the celebration here!</p>
      </div>
    );
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative group">
      {/* Background Decorative Elements */}
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>

      <div className="relative z-10 bg-gradient-to-br from-white via-white to-green-50/30 backdrop-blur-2xl rounded-[3rem] border border-gray-100 p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.06)] hover:shadow-[0_50px_120px_rgba(0,0,0,0.1)] transition-all duration-700">
        
        {/* Floating Trophy Icon */}
        <div className="absolute top-8 right-8 md:top-12 md:right-12 text-green-500/20 group-hover:text-green-500 transition-all duration-700 rotate-12 group-hover:rotate-0 scale-150">
          <Trophy size={80} />
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
          {/* Large Image Presentation */}
          <div className="relative flex-shrink-0">
            <div className="w-40 h-40 md:w-56 md:h-56 rounded-[3rem] overflow-hidden border-8 border-white shadow-2xl bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center rotate-3 group-hover:rotate-0 transition-all duration-500">
              {latestPost.photo_url ? (
                <img 
                  src={latestPost.photo_url} 
                  alt={latestPost.nurse_name} 
                  className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700" 
                />
              ) : (
                <span className="text-7xl font-black text-green-600 drop-shadow-md">{latestPost.nurse_name[0]}</span>
              )}
            </div>
            {/* Sparkle Decoration */}
            <div className="absolute -bottom-4 -right-4 bg-white p-3 rounded-2xl shadow-xl border border-gray-50 animate-bounce">
              <Sparkles className="text-yellow-500 w-6 h-6" />
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 text-center md:text-left pt-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
              <span className="px-4 py-1.5 bg-green-50 text-[10px] font-black text-green-600 rounded-full uppercase tracking-[0.2em] border border-green-100 flex items-center gap-2">
                <Sparkles size={10} /> Star of the Moment
              </span>
              <div className="flex items-center gap-1.5 text-gray-400">
                <Clock size={12} className="text-green-500" />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">{formatTime(latestPost.created_at)}</span>
              </div>
            </div>

            <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter leading-none mb-6 group-hover:text-green-600 transition-colors">
              {latestPost.nurse_name}
            </h2>

            <div className="relative max-w-2xl">
              <div className="absolute -left-6 -top-6 text-green-500/10 scale-150">
                <Quote size={60} />
              </div>
              <p className="text-xl md:text-2xl font-bold text-gray-600 leading-relaxed italic relative z-10 pl-2">
                {latestPost.message}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center md:justify-start gap-6">
              <div className="flex items-center gap-3 px-6 py-3 bg-white/50 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-xs shadow-sm">
                      <Heart size={12} className="text-white fill-current" />
                    </div>
                  ))}
                </div>
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Admired by the team</span>
              </div>
              
              <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest border-l border-gray-100 pl-6 h-12 flex items-center">
                Celebration ID: {latestPost.id.slice(0, 8)}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar Info */}
        <div className="mt-12 pt-8 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-black text-xs">A</div>
             <p className="text-sm font-bold text-gray-400">Recognized by <span className="text-gray-900 font-black">{latestPost.created_by}</span></p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {isAdmin && (
              <button 
                onClick={handleDelete}
                className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-100"
                title="Remove Celebration"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button className="px-8 py-3 bg-gray-900 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-green-600 transition-all active:scale-95 shadow-xl shadow-black/10">
              Send Congratulations
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
