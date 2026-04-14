import React from "react";
import { Star, Trash2, Award, Stethoscope, UserPlus } from "lucide-react";
import { deleteCongratulationsPost } from "../../../api/congratulations";
import { useQueryClient } from "@tanstack/react-query";
import logo from "../../../Image/logo.png";

// ─── Theme configs ────────────────────────────────────────────────────────────
const THEMES = {
  nurse: {
    gradientFrom: "#059669",
    gradientTo: "#047857",
    accentLight: "#d1fae5",
    accentMid: "#6ee7b7",
    accentBorder: "#34d399",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    badgeLabel: "NURSE",
    roleIcon: <UserPlus size={11} />,
    avatarRing: "ring-emerald-400",
    avatarBg: "bg-emerald-50",
    avatarText: "text-emerald-400",
    footerLine: "bg-emerald-200",
    shimmer: "from-emerald-500/10 via-transparent to-transparent",
    defaultDesignation: "Staff Nurse",
    starColor: "#10b981",
  },
  rmo: {
    gradientFrom: "#4f46e5",
    gradientTo: "#3730a3",
    accentLight: "#e0e7ff",
    accentMid: "#a5b4fc",
    accentBorder: "#818cf8",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-700",
    badgeLabel: "RMO",
    roleIcon: <Stethoscope size={11} />,
    avatarRing: "ring-indigo-400",
    avatarBg: "bg-indigo-50",
    avatarText: "text-indigo-400",
    footerLine: "bg-indigo-200",
    shimmer: "from-indigo-500/10 via-transparent to-transparent",
    defaultDesignation: "Resident Medical Officer",
    starColor: "#6366f1",
  },
};

// ─── Single Card ─────────────────────────────────────────────────────────────
function CelebrationCard({ post, isAdmin, onDelete }) {
  if (!post) return null;

  const postType = post.post_type === "rmo" ? "rmo" : "nurse";
  const theme = THEMES[postType];
  const initials = post.nurse_name
    ? post.nurse_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div className="relative group flex-1 min-w-0 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 border border-white/60 hover:-translate-y-1">
      {/* ── Header gradient band ── */}
      <div
        className="relative px-5 pt-5 pb-10 flex flex-col items-center gap-1 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
        }}
      >
        {/* Shimmer overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${theme.shimmer} pointer-events-none`}
        />

        {/* Hospital logo + title */}
        <img
          src={logo}
          alt="Logo"
          className="h-9 object-contain opacity-90 mb-1"
        />
        <p className="text-[8px] font-black text-white/70 tracking-[0.22em] uppercase text-center">
          THE PRIDE OF MAMTA CAREGIVERS
        </p>
        <p
          className="text-white/90 mt-0.5 leading-none"
          style={{ fontFamily: "'Great Vibes', cursive", fontSize: "1.7rem" }}
        >
          Appreciation
        </p>

        {/* Role badge */}
        <div
          className={`absolute top-3 right-3 flex items-center gap-1 ${theme.badgeBg} ${theme.badgeText} rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest shadow-sm`}
        >
          {theme.roleIcon}
          {theme.badgeLabel}
        </div>

        {/* Star top-left */}
        <Star
          className="absolute top-3 left-3 drop-shadow"
          size={18}
          style={{ color: "#FFD700", fill: "#FFD700" }}
        />
      </div>

      {/* ── Photo bubble — overlapping the header ── */}
      <div className="flex justify-center -mt-10 relative z-10 px-5">
        <div
          className={`w-20 h-20 rounded-full ring-4 ${theme.avatarRing} shadow-xl overflow-hidden bg-white flex-shrink-0`}
        >
          {post.photo_url ? (
            <img
              src={post.photo_url}
              alt={post.nurse_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center ${theme.avatarBg} ${theme.avatarText} text-2xl font-black`}
            >
              {initials}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-white px-5 pb-5 pt-3 flex flex-col items-center text-center">
        {/* Name */}
        <h2
          className="text-base font-black text-gray-900 tracking-tight leading-tight mt-1"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {post.nurse_name}
        </h2>

        {/* Designation pill */}
        <span
          className={`inline-block mt-1.5 mb-3 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${theme.badgeBg} ${theme.badgeText}`}
        >
          {post.designation || theme.defaultDesignation}
        </span>

        {/* Divider */}
        <div
          className="w-10 h-0.5 rounded-full mb-3"
          style={{
            background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
          }}
        />

        {/* Message */}
        <div className="relative w-full">
          {/* Big decorative quote */}
          <span
            className="absolute -top-2 -left-1 text-5xl leading-none select-none pointer-events-none font-serif"
            style={{ color: theme.accentLight }}
          >
            &#8220;
          </span>
          <p
            className="text-[11px] md:text-xs font-semibold text-gray-600 leading-relaxed italic relative z-10 px-3"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {post.message}
          </p>
          <span
            className="absolute -bottom-3 -right-1 text-5xl leading-none select-none pointer-events-none font-serif"
            style={{ color: theme.accentLight }}
          >
            &#8221;
          </span>
        </div>

        {/* Footer signature */}
        <div className="mt-6 w-full flex flex-col items-center">
          <div className={`h-px w-20 ${theme.footerLine} mb-2`} />
          <p
            className="text-base text-gray-800"
            style={{ fontFamily: "'Great Vibes', cursive" }}
          >
            Dr. Kanak Ramnani
          </p>
          <p className="text-[7px] font-black text-gray-400 uppercase tracking-[0.18em] mt-0.5">
            Director, Mamta Superspeciality Hospital
          </p>
        </div>

        {/* Award icon watermark */}
        <Award
          size={80}
          className="absolute bottom-4 right-4 opacity-[0.03] pointer-events-none"
          style={{ color: theme.gradientFrom }}
        />
      </div>

      {/* Delete overlay */}
      {isAdmin && (
        <button
          onClick={() => onDelete(post)}
          title="Remove post"
          className="absolute top-3 left-3 p-1.5 bg-white/20 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow backdrop-blur-sm z-20"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="flex-1 min-w-0 rounded-2xl overflow-hidden shadow border border-gray-100 animate-pulse">
      <div className="h-28 bg-gray-200" />
      <div className="flex justify-center -mt-8">
        <div className="w-16 h-16 rounded-full bg-gray-300 ring-4 ring-white" />
      </div>
      <div className="bg-white p-5 pt-3 flex flex-col items-center gap-2">
        <div className="h-4 w-28 bg-gray-200 rounded-full" />
        <div className="h-3 w-20 bg-gray-100 rounded-full" />
        <div className="h-0.5 w-10 bg-gray-100 rounded-full" />
        <div className="h-3 w-full bg-gray-100 rounded-full" />
        <div className="h-3 w-4/5 bg-gray-100 rounded-full" />
        <div className="h-3 w-3/5 bg-gray-100 rounded-full" />
        <div className="mt-4 h-3 w-24 bg-gray-200 rounded-full" />
      </div>
    </div>
  );
}

// ─── Main Feed ────────────────────────────────────────────────────────────────
export default function CongratulationsFeed({ posts, isLoading, isAdmin }) {
  const queryClient = useQueryClient();

  const latestNursePost =
    posts?.find((p) => p.post_type === "nurse" || !p.post_type) || null;
  const latestRmoPost = posts?.find((p) => p.post_type === "rmo") || null;
  const latestPost = posts?.[0] || null;

  React.useEffect(() => {
    if (!latestPost) return;
    const createdAt = new Date(latestPost.created_at).getTime();
    const expiryTime = createdAt + 24 * 60 * 60 * 1000;
    const now = Date.now();
    const msUntilExpiry = expiryTime - now;

    if (msUntilExpiry > 0) {
      const timer = setTimeout(() => {
        queryClient.invalidateQueries(["congratulations-posts"]);
      }, msUntilExpiry + 1000);
      return () => clearTimeout(timer);
    } else {
      queryClient.invalidateQueries(["congratulations-posts"]);
    }
  }, [latestPost, queryClient]);

  const handleDelete = async (post) => {
    if (!post || !window.confirm("Remove this celebration post?")) return;
    try {
      await deleteCongratulationsPost(post.id);
      queryClient.invalidateQueries(["congratulations-posts"]);
    } catch (err) {
      console.error(err);
      alert("Failed to delete post.");
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const hasNurse = !!latestNursePost;
  const hasRmo = !!latestRmoPost;

  if (!hasNurse && !hasRmo) {
    if (!isAdmin) return null;
    return (
      <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-100 p-10 flex flex-col items-center justify-center text-center gap-3 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
          <Star className="text-gray-200" size={28} />
        </div>
        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">
          Wall of Praise is Empty
        </p>
        <p className="text-xs text-gray-400">
          Create a post for a Nurse or RMO to get started.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-4 ${
        hasNurse && hasRmo
          ? "grid-cols-1 sm:grid-cols-2"
          : "grid-cols-1 max-w-sm mx-auto w-full"
      }`}
    >
      {hasNurse && (
        <CelebrationCard
          post={latestNursePost}
          isAdmin={isAdmin}
          onDelete={handleDelete}
        />
      )}
      {hasRmo && (
        <CelebrationCard
          post={latestRmoPost}
          isAdmin={isAdmin}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
