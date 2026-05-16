import React, { useState, useEffect } from "react";
import { getStoreOutRequests } from "../../api/store";
import { Loader2, Search, Filter } from "lucide-react";
import { useNotification } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";

export default function StoreOutTracker() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const { showNotification } = useNotification();
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getStoreOutRequests();
      setRequests(data || []);
    } catch (err) {
      console.error("Error fetching store out requests:", err);
      showNotification("Failed to fetch store out requests", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      (req.issue_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.product_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus =
      statusFilter === "All" || req.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statuses = ["All", ...new Set(requests.map((r) => r.status).filter(Boolean))];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Store Out Tracker</h1>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">View and track store out requests</p>
          </div>
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by Issue No or Product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-full sm:w-64 transition-all"
              />
            </div>
            
            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-full sm:w-48 transition-all appearance-none"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
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
                  <div key={req.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">
                          {req.issue_no || "N/A"}
                        </h3>
                        <p className="text-xs text-gray-500 font-bold">
                          {req.issue_date ? new Date(req.issue_date).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                      <span className={`inline-flex px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full ${
                        req.status === "Approved" 
                          ? "bg-green-100 text-green-700" 
                          : req.status === "Pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {req.status || "Pending"}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-bold text-gray-700">Product:</span>{" "}
                        <span className="text-gray-900">{req.product_name || "N/A"}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-700">Qty:</span>{" "}
                        <span className="text-gray-600">{req.qty} {req.unit}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-700">Requested By:</span>{" "}
                        <span className="text-gray-600">{req.requested_by || "N/A"}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-700">Ward/Dept:</span>{" "}
                        <span className="text-gray-600">{req.ward_name || req.department || "N/A"}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-700">Approved By:</span>{" "}
                        <span className="text-gray-600">{req.approved_by || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white">
                    <tr>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Issue No</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Product</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Qty</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Requested By</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Ward/Dept</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Approved By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{req.issue_no || "N/A"}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-600">
                          {req.issue_date ? new Date(req.issue_date).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{req.product_name || "N/A"}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-600">
                          {req.qty} {req.unit}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-600">{req.requested_by || "N/A"}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-600">
                          {req.ward_name || req.department || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full ${
                            req.status === "Approved" 
                              ? "bg-green-100 text-green-700" 
                              : req.status === "Pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {req.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-600">{req.approved_by || "N/A"}</td>
                      </tr>
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
