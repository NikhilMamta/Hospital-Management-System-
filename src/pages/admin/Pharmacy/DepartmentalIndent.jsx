import React, { useMemo, useState } from "react";
import { CheckCircle, Edit, Eye, Pill, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotification } from "../../../contexts/NotificationContext";
import {
  getDepartmentalMasters,
  getDepartmentalIndentsList,
  createDepartmentalIndent,
  updateDepartmentalIndent,
  deleteDepartmentalIndent,
} from "../../../api/pharmacy";
import useRealtimeQuery from "../../../hooks/useRealtimeQuery";
import { normalizeDepartmentalPharmacyIndent } from "../../../utils/pharmacyIndentUtils";
import { sendDepartmentalIndentApprovalNotification } from "../../../utils/whatsappService";

const defaultRequestTypes = { medicineSlip: true };
const isApprovedIndent = (status) => typeof status === "string" && status.toLowerCase().includes("approved");

const DepartmentalIndent = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [successData, setSuccessData] = useState(null);

  const currentUser = useMemo(() => {
    try {
      const storedUser = localStorage.getItem("mis_user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) { return null; }
  }, []);

  const [formData, setFormData] = useState({ requestedBy: currentUser?.name || "", ward: "", remarks: "" });
  const [requestTypes, setRequestTypes] = useState(defaultRequestTypes);
  const [medicines, setMedicines] = useState([]);

  // --- Queries ---
  const { data: masters = { locations: [], medicines: [] } } = useQuery({
    queryKey: ['pharmacy', 'departmental', 'masters'],
    queryFn: getDepartmentalMasters
  });

  const { data: rawIndents = [], isLoading: loading } = useQuery({
    queryKey: ['pharmacy', 'departmental', 'indents'],
    queryFn: getDepartmentalIndentsList
  });

  useRealtimeQuery(['pharmacy', 'departmental_pharmacy_indent'], ['pharmacy', 'departmental', 'indents']);

  // --- Derived Data ---
  const normalizedIndents = useMemo(() => rawIndents.map(normalizeDepartmentalPharmacyIndent), [rawIndents]);

  const wardOptions = useMemo(() => {
    const baseWards = [...new Set(masters.locations.map(l => l.ward).filter(Boolean))];
    return [...new Set([...baseWards, "OT", "OPTHAL"])].sort();
  }, [masters.locations]);

  const filteredRecords = useMemo(() => normalizedIndents.filter(r => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = !query || [r.indentNumber, r.displayTitle, r.location, r.requestedBy, r.remarks].filter(Boolean).join(" ").toLowerCase().includes(query);
    const matchesStatus = filterStatus === "all" || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  }), [normalizedIndents, searchTerm, filterStatus]);

  // --- Helpers ---
  const resetForm = () => {
    setFormData({ requestedBy: currentUser?.name || "", ward: "", remarks: "" });
    setRequestTypes(defaultRequestTypes);
    setMedicines([]);
    setSelectedIndent(null);
    setEditMode(false);
  };

  const getIndianTimestamp = () => new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", "");

  // --- Mutations ---
  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (editMode && selectedIndent) {
        return await updateDepartmentalIndent(selectedIndent.sourceId, payload);
      }
      return await createDepartmentalIndent(payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'departmental', 'indents'] });
      showNotification(`Indent ${editMode ? "updated" : "created"} successfully!`, "success");
      
      sendDepartmentalIndentApprovalNotification(data, medicines, requestTypes).catch(e => console.error("WhatsApp error", e));

      setSuccessData({ indentNumber: data.indent_no, wardLocation: data.ward_location, requestedBy: data.requested_by });
      setShowModal(false);
      setSuccessModal(true);
      resetForm();
    },
    onError: (e) => showNotification(`Error: ${e.message}`, "error")
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDepartmentalIndent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'departmental', 'indents'] });
      showNotification("Indent deleted successfully", "success");
    },
    onError: (e) => showNotification(`Error deleting: ${e.message}`, "error")
  });

  const handleSubmit = () => {
    if (!formData.requestedBy || !formData.ward) return showNotification("Please fill required fields", "error");
    if (requestTypes.medicineSlip && (!medicines.length || medicines.some(m => !m.name || !m.quantity))) return showNotification("Please complete medicine rows", "error");

    const payload = {
      timestamp: getIndianTimestamp(),
      requested_by: formData.requestedBy,
      indent_scope: "departmental",
      ward: formData.ward,
      ward_location: formData.ward,
      remarks: formData.remarks,
      request_types: JSON.stringify(requestTypes),
      medicines: JSON.stringify(medicines),
      status: "pending",
      planned1: getIndianTimestamp(),
      ...(editMode ? { indent_no: selectedIndent.indentNumber } : {})
    };
    mutation.mutate(payload);
  };

  const handleEdit = (indent) => {
    if (isApprovedIndent(indent.status)) return showNotification("Approved indents cannot be edited", "error");
    setSelectedIndent(indent);
    setEditMode(true);
    setFormData({ requestedBy: indent.requestedBy || "", ward: indent.ward || "", remarks: indent.remarks || "" });
    setRequestTypes({ ...defaultRequestTypes, ...indent.requestTypes });
    setMedicines((indent.medicines || []).map((m, i) => ({ ...m, id: m.id || Date.now() + i })));
    setShowModal(true);
  };

  const handleDelete = (indent) => {
    if (isApprovedIndent(indent.status)) return showNotification("Approved indents cannot be deleted", "error");
    if (window.confirm("Delete this indent?")) deleteMutation.mutate(indent.sourceId);
  };

  const addMedicine = () => setMedicines([...medicines, { id: Date.now(), name: "", quantity: "" }]);
  const removeMedicine = (id) => setMedicines(medicines.filter(m => m.id !== id));
  const updateMedicine = (id, field, val) => setMedicines(medicines.map(m => m.id === id ? { ...m, [field]: val } : m));

  return (
    <div className="min-h-screen bg-gray-50 pb-20 p-3 sm:p-6 lg:pb-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-2xl font-bold text-gray-800">Departmental Indents</h1><p className="text-sm text-gray-500">Ward medicine requests</p></div>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="px-5 py-2.5 bg-green-600 text-white rounded-lg flex items-center gap-2 font-semibold shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all"><Plus className="w-5 h-5"/> New Indent</button>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-100 transition-all"/></div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2 bg-white border rounded-lg text-sm outline-none"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 hidden md:table">
            <thead className="bg-green-600 text-white text-xs uppercase font-semibold">
              <tr><th className="px-6 py-4 text-left">Indent No</th><th className="px-6 py-4 text-left">Ward</th><th className="px-6 py-4 text-left">Requested By</th><th className="px-6 py-4 text-left">Status</th><th className="px-6 py-4 text-center">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? <tr><td colSpan="5" className="text-center py-10 text-gray-400">Loading...</td></tr> : filteredRecords.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-6 py-4 font-bold text-green-700">{r.indentNumber}</td>
                  <td className="px-6 py-4">{r.displayTitle}</td>
                  <td className="px-6 py-4">{r.requestedBy}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span></td>
                  <td className="px-6 py-4 flex justify-center gap-2">
                    <button onClick={() => { setSelectedIndent(r); setViewModal(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg"><Eye size={16}/></button>
                    <button onClick={() => handleEdit(r)} disabled={isApprovedIndent(r.status)} className="p-2 bg-amber-50 text-amber-600 rounded-lg disabled:opacity-30"><Edit size={16}/></button>
                    {currentUser?.role !== 'nurse' && <button onClick={() => handleDelete(r)} disabled={isApprovedIndent(r.status)} className="p-2 bg-red-50 text-red-600 rounded-lg disabled:opacity-30"><Trash2 size={16}/></button>}
                  </td>
                </tr>
              ))}
              {!loading && !filteredRecords.length && <tr><td colSpan="5" className="text-center py-10 text-gray-400 italic">No indents found</td></tr>}
            </tbody>
          </table>
          <div className="md:hidden space-y-3 p-3">
             {filteredRecords.map(r => (
               <div key={r.id} className="p-4 bg-white border rounded-xl shadow-sm">
                 <div className="flex justify-between items-start mb-2"><span className="font-bold text-green-700">{r.indentNumber}</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span></div>
                 <div className="font-semibold mb-1">{r.displayTitle}</div><div className="text-xs text-gray-500 mb-4">By {r.requestedBy}</div>
                 <div className="flex gap-2">
                   <button onClick={() => { setSelectedIndent(r); setViewModal(true); }} className="flex-1 py-2 bg-green-50 text-green-600 rounded font-bold text-xs">View</button>
                   <button onClick={() => handleEdit(r)} disabled={isApprovedIndent(r.status)} className="flex-1 py-2 bg-amber-50 text-amber-600 rounded font-bold text-xs disabled:opacity-30">Edit</button>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center"><h2 className="text-lg font-bold">{editMode ? "Edit Indent" : "New Departmental Indent"}</h2><button onClick={() => setShowModal(false)}><X/></button></div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Requested By</label><input value={formData.requestedBy} onChange={e => setFormData({ ...formData, requestedBy: e.target.value })} className="w-full p-2.5 bg-gray-50 border rounded-lg focus:bg-white outline-none"/></div>
                <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Ward</label><select value={formData.ward} onChange={e => setFormData({ ...formData, ward: e.target.value })} className="w-full p-2.5 bg-gray-50 border rounded-lg focus:bg-white outline-none"><option value="">Select Ward</option>{wardOptions.map(w => <option key={w} value={w}>{w}</option>)}</select></div>
                <div className="md:col-span-2 space-y-1"><label className="text-xs font-bold text-gray-500 uppercase">Remarks</label><textarea rows="2" value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} className="w-full p-2.5 bg-gray-50 border rounded-lg focus:bg-white outline-none" placeholder="Optional notes..."/></div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border">
                 <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center gap-2"><Pill className="text-green-600"/> Medicines</h3><button onClick={addMedicine} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold shadow-lg shadow-green-100">+ Add</button></div>
                 <div className="space-y-3">
                   {medicines.map(m => (
                     <div key={m.id} className="grid grid-cols-[1fr_80px_40px] gap-2 items-center">
                        <input list="med-list" placeholder="Medicine name" value={m.name} onChange={e => updateMedicine(m.id, 'name', e.target.value)} className="p-2 border rounded-lg text-sm bg-white outline-none"/>
                        <input type="number" placeholder="Qty" value={m.quantity} onChange={e => updateMedicine(m.id, 'quantity', e.target.value)} className="p-2 border rounded-lg text-sm bg-white outline-none text-center"/>
                        <button onClick={() => removeMedicine(m.id)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                     </div>
                   ))}
                   <datalist id="med-list">{masters.medicines.map(m => <option key={m} value={m}/>)}</datalist>
                 </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3"><button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-500 font-bold">Cancel</button><button onClick={handleSubmit} disabled={mutation.isPending} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow-lg shadow-green-100 flex items-center gap-2">{mutation.isPending ? 'Saving...' : <><Save size={18}/> {editMode ? 'Update Indent' : 'Create Indent'}</>}</button></div>
          </div>
        </div>
      )}

      {viewModal && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setViewModal(false)}>
           <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-green-700">{selectedIndent.indentNumber}</h2><button onClick={() => setViewModal(false)}><X/></button></div>
              <div className="grid grid-cols-2 gap-y-4 text-sm mb-6 pb-6 border-b">
                 <div><div className="text-gray-400 uppercase text-[10px] font-bold">Requester</div><div className="font-bold">{selectedIndent.requestedBy}</div></div>
                 <div><div className="text-gray-400 uppercase text-[10px] font-bold">Ward</div><div className="font-bold">{selectedIndent.displayTitle}</div></div>
                 <div className="col-span-2"><div className="text-gray-400 uppercase text-[10px] font-bold">Remarks</div><div className="text-gray-700 italic">{selectedIndent.remarks || 'No remarks provided'}</div></div>
              </div>
              <div><h3 className="font-bold mb-3 flex items-center gap-2">Ordered Items <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{selectedIndent.medicines?.length || 0}</span></h3><div className="max-h-60 overflow-y-auto space-y-2">{selectedIndent.medicines?.map((m, i) => <div key={i} className="flex justify-between p-2.5 bg-gray-50 rounded-lg text-sm border-l-4 border-green-500"><span>{m.name}</span><span className="font-bold text-green-700">x{m.quantity}</span></div>)}</div></div>
              <div className="mt-8"><button onClick={() => setViewModal(false)} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold">Close View</button></div>
           </div>
        </div>
      )}

      {successModal && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-2xl p-8 text-center shadow-2xl animate-scale-in">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-6"><CheckCircle size={48}/></div>
              <h2 className="text-2xl font-bold mb-2">Indent Submitted!</h2>
              <p className="text-gray-500 mb-6">Indent <span className="font-bold text-green-700">{successData.indentNumber}</span> for {successData.wardLocation} has been sent for approval.</p>
              <button onClick={() => setSuccessModal(false)} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-100 hover:bg-green-700">Awesome, got it!</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentalIndent;
