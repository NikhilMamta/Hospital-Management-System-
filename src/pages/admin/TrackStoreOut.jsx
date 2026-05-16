import React, { useState, useEffect } from "react";
import { getUserStoreOutRequests, getStoreOutApproval } from "../../api/store";
import { Loader2, Search, CheckCircle2, Clock, XCircle, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useNotification } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";

export default function TrackStoreOut() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [expandedData, setExpandedData] = useState({}); // { [id]: approvalData }
  const [loadingDetails, setLoadingDetails] = useState({}); // { [id]: boolean }
  const { showNotification } = useNotification();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.name) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getUserStoreOutRequests(user.name);
      setRequests(data || []);
    } catch (err) {
      console.error("Error fetching store out requests:", err);
      showNotification("Failed to fetch requests", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExpandRow = async (requestId, indentNumber) => {
    if (expandedRowId === requestId) {
      setExpandedRowId(null);
      return;
    }

    setExpandedRowId(requestId);

    // Fetch details if not already loaded (Optimization: only fetch approval data)
    if (!expandedData[requestId] && indentNumber) {
      setLoadingDetails((prev) => ({ ...prev, [requestId]: true }));
      try {
        const data = await getStoreOutApproval(indentNumber);
        setExpandedData((prev) => ({ ...prev, [requestId]: data }));
      } catch (err) {
        console.error("Error fetching request details:", err);
        showNotification("Failed to fetch details", "error");
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [requestId]: false }));
      }
    }
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      (req.issue_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.product_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.indent_number || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Helper to determine stage status using row data (req) and fetched approval data
  const getStageStatus = (req, stage) => {
    if (stage === 1) {
      return "completed";
    }

    if (stage === 2) {
      if (req.status === "Approved") return "completed";
      if (req.status === "Rejected") return "failed";
      return "current"; // Pending
    }

    if (stage === 3) {
      if (req.status !== "Approved") return "pending";
      
      const approval = expandedData[req.id];
      if (approval) {
        if (approval.status === "Approved") return "completed";
        if (approval.status === "Rejected") return "failed";
        return "current"; // Pending in store
      }
      return "current"; // Waiting for store to pick it up
    }

    return "pending";
  };

  const renderStepIcon = (status) => {
    if (status === "completed") return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    if (status === "current") return <Clock className="w-6 h-6 text-yellow-500 animate-pulse" />;
    if (status === "failed") return <XCircle className="w-6 h-6 text-red-500" />;
    return <Clock className="w-6 h-6 text-gray-300" />;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">My Store Outs</h1>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Track the status of your requests</p>
          </div>
          
          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-full transition-all"
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12">
              <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-4">Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center p-12">
              <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">No requests found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4 p-4">
                {filteredRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-50/50"
                      onClick={() => handleExpandRow(req.id, req.indent_number)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">
                            {req.indent_number || "N/A"}
                          </h3>
                          <p className="text-xs text-gray-500 font-bold">
                            {req.issue_date ? new Date(req.issue_date).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                        <span className={`inline-flex px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full ${
                          req.status === "Approved" 
                            ? "bg-green-100 text-green-700" 
                            : req.status === "Rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {req.status || "Pending"}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-800">{req.product_name || "N/A"}</p>
                        <p className="text-xs font-bold text-gray-600">
                          Qty: {req.qty} {req.unit}
                        </p>
                      </div>
                      
                      <div className="flex justify-end mt-2">
                        {expandedRowId === req.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>

                    {/* Expanded Content (Timeline) */}
                    {expandedRowId === req.id && (
                      <div className="bg-gray-50/50 p-4 border-t border-gray-100">
                        {loadingDetails[req.id] ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading status...</span>
                          </div>
                        ) : (
                          <div className="relative">
                            {/* Progress Line */}
                            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                            <div className="flex flex-col space-y-6 relative">
                              {/* Step 1 */}
                              <div className="flex items-start gap-3">
                                <div className="bg-gray-50 relative z-10 p-0.5">
                                  {renderStepIcon(getStageStatus(req, 1))}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Request Raised</p>
                                  <p className="text-[10px] font-bold text-gray-400">
                                    {new Date(req.timestamp).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              {/* Step 2 */}
                              <div className="flex items-start gap-3">
                                <div className="bg-gray-50 relative z-10 p-0.5">
                                  {renderStepIcon(getStageStatus(req, 2))}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Approval Stage</p>
                                  <p className="text-[10px] font-bold text-gray-400">
                                    {req.status === "Approved" 
                                      ? `Approved by ${req.approved_by || "Manager"}`
                                      : req.status === "Rejected"
                                      ? "Rejected"
                                      : "Pending Manager Approval"}
                                  </p>
                                </div>
                              </div>

                              {/* Step 3 */}
                              <div className="flex items-start gap-3">
                                <div className="bg-gray-50 relative z-10 p-0.5">
                                  {renderStepIcon(getStageStatus(req, 3))}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Store Out Stage</p>
                                  <p className="text-[10px] font-bold text-gray-400">
                                    {expandedData[req.id]?.status === "Approved"
                                      ? "Materials Issued"
                                      : expandedData[req.id]?.status === "Rejected"
                                      ? "Rejected by Store"
                                      : "Waiting for Store Issue"}
                                  </p>
                                  {expandedData[req.id]?.slip && (
                                    <a 
                                      href={expandedData[req.id].slip} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700 mt-1"
                                    >
                                      <FileText size={10} />
                                      View Slip
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white">
                    <tr>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Indent No</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Product</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Qty</th>
                      <th className="px-4 py-4 text-xs font-black uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRequests.map((req) => (
                      <React.Fragment key={req.id}>
                        <tr 
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                          onClick={() => handleExpandRow(req.id, req.indent_number)}
                        >
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{req.indent_number || "N/A"}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-600">
                            {req.issue_date ? new Date(req.issue_date).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{req.product_name || "N/A"}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-600">
                            {req.qty} {req.unit}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full ${
                              req.status === "Approved" 
                                ? "bg-green-100 text-green-700" 
                                : req.status === "Rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {req.status || "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {expandedRowId === req.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </td>
                        </tr>

                        {/* Expanded Row */}
                        {expandedRowId === req.id && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50/50 p-6">
                              {loadingDetails[req.id] ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading status...</span>
                                </div>
                              ) : (
                                <div className="max-w-4xl mx-auto">
                                  <div className="relative">
                                    {/* Progress Line */}
                                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 md:left-0 md:right-0 md:top-3 md:bottom-auto md:w-auto md:h-0.5"></div>

                                    <div className="flex flex-col space-y-6 md:flex-row md:space-y-0 md:justify-between relative">
                                      {/* Step 1 */}
                                      <div className="flex items-start md:flex-col md:items-center md:text-center gap-3 md:gap-2">
                                        <div className="bg-gray-50 relative z-10 p-0.5">
                                          {renderStepIcon(getStageStatus(req, 1))}
                                        </div>
                                        <div>
                                          <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Request Raised</p>
                                          <p className="text-[10px] font-bold text-gray-400">
                                            {new Date(req.timestamp).toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Step 2 */}
                                      <div className="flex items-start md:flex-col md:items-center md:text-center gap-3 md:gap-2">
                                        <div className="bg-gray-50 relative z-10 p-0.5">
                                          {renderStepIcon(getStageStatus(req, 2))}
                                        </div>
                                        <div>
                                          <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Approval Stage</p>
                                          <p className="text-[10px] font-bold text-gray-400">
                                            {req.status === "Approved" 
                                              ? `Approved by ${req.approved_by || "Manager"}`
                                              : req.status === "Rejected"
                                              ? "Rejected"
                                              : "Pending Manager Approval"}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Step 3 */}
                                      <div className="flex items-start md:flex-col md:items-center md:text-center gap-3 md:gap-2">
                                        <div className="bg-gray-50 relative z-10 p-0.5">
                                          {renderStepIcon(getStageStatus(req, 3))}
                                        </div>
                                        <div>
                                          <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Store Out Stage</p>
                                          <p className="text-[10px] font-bold text-gray-400">
                                            {expandedData[req.id]?.status === "Approved"
                                              ? "Materials Issued"
                                              : expandedData[req.id]?.status === "Rejected"
                                              ? "Rejected by Store"
                                              : "Waiting for Store Issue"}
                                          </p>
                                          {expandedData[req.id]?.slip && (
                                            <a 
                                              href={expandedData[req.id].slip} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700 mt-1"
                                            >
                                              <FileText size={10} />
                                              View Slip
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
