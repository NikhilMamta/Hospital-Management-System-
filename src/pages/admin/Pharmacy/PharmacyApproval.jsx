import React, { useState, useEffect, useRef } from 'react';
import { Eye, CheckCircle, XCircle, FileText, X, Download, Edit, Save, Trash2, Plus, Search, ChevronDown } from 'lucide-react';
import supabase from '../../../SupabaseClient'; // Adjust the path as needed
import { useNotification } from '../../../contexts/NotificationContext';

const DUMMY_MEDICINE_NAMES = [
  'Paracetamol 500mg',
  'Amoxicillin 250mg',
  'Ibuprofen 400mg',
  'Cough Syrup',
  'Vitamin D3',
  'Omeprazole 20mg',
  'Aspirin 75mg',
  'Metformin 500mg',
  'Cetirizine 10mg',
  'Azithromycin 500mg',
  'Ciprofloxacin 500mg',
  'Diclofenac 50mg',
  'Atorvastatin 20mg',
  'Losartan 50mg',
  'Levothyroxine 50mcg',
  'Pantoprazole 40mg',
  'Clopidogrel 75mg',
  'Insulin Glargine',
  'Salbutamol Inhaler',
  'Prednisolone 5mg',
  'Metronidazole 400mg',
  'Ranitidine 150mg',
  'Furosemide 40mg',
  'Amlodipine 5mg',
  'Gabapentin 300mg'
];

// Custom Medicine Dropdown Component
const MedicineDropdown = ({ medicine, onUpdate, index, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const filteredMedicines = DUMMY_MEDICINE_NAMES.filter(med =>
    med.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (medName) => {
    onUpdate(medicine.id, 'name', medName);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={medicine.name}
          onChange={(e) => onUpdate(medicine.id, 'name', e.target.value)}
          onClick={() => setIsOpen(true)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
          placeholder="Select or type medicine name"
          readOnly={loading}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          disabled={loading}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Search Input */}
          <div className="sticky top-0 bg-white p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Search medicines..."
                autoFocus
              />
            </div>
          </div>

          {/* Medicine List */}
          <div className="py-1">
            {filteredMedicines.length > 0 ? (
              filteredMedicines.map((medName) => (
                <button
                  key={medName}
                  type="button"
                  onClick={() => handleSelect(medName)}
                  className={`w-full text-left px-4 py-2 hover:bg-green-50 hover:text-green-700 ${medicine.name === medName ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-700'
                    }`}
                >
                  {medName}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-gray-500 text-center">
                No medicines found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PharmacyApproval = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [viewModal, setViewModal] = useState(false);
  const [slipModal, setSlipModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [pendingIndents, setPendingIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [statusChanges, setStatusChanges] = useState({});
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();

  // Investigation tests from Supabase
  const [pathologyTests, setPathologyTests] = useState([]);
  const [xrayTests, setXrayTests] = useState([]);
  const [ctScanTests, setCtScanTests] = useState([]);
  const [usgTests, setUsgTests] = useState([]);

  // Filter States
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [patientNames, setPatientNames] = useState([]);

  // Parse JSON fields from Supabase
  const parseJsonField = (field) => {
    try {
      return field ? JSON.parse(field) : {};
    } catch (error) {
      console.error('Error parsing JSON field:', error);
      return {};
    }
  };

  // Show popup function (legacy - use showNotification)
  const showPopup = (message, type = 'success') => {
    showNotification(message, type);
  };

  // Fetch investigation tests from Supabase
  const fetchInvestigationTests = async () => {
    try {
      setLoading(true);

      // Fetch Pathology tests
      const { data: pathologyData, error: pathologyError } = await supabase
        .from('investigation')
        .select('name, type')
        .eq('type', 'Pathology')
        .order('name');

      if (pathologyError) {
        console.error('Error fetching pathology tests:', pathologyError);
        showPopup('Error fetching pathology tests', 'error');
      } else {
        setPathologyTests(pathologyData.map(item => item.name));
      }

      // Fetch CT Scan tests
      const { data: ctScanData, error: ctScanError } = await supabase
        .from('investigation')
        .select('name, type')
        .eq('type', 'CT Scan')
        .order('name');

      if (ctScanError) {
        console.error('Error fetching CT Scan tests:', ctScanError);
        showPopup('Error fetching CT Scan tests', 'error');
      } else {
        setCtScanTests(ctScanData.map(item => item.name));
      }

      // Fetch X-ray tests
      const { data: xrayData, error: xrayError } = await supabase
        .from('investigation')
        .select('name, type')
        .eq('type', 'X-ray')
        .order('name');

      if (xrayError) {
        console.error('Error fetching X-ray tests:', xrayError);
        showPopup('Error fetching X-ray tests', 'error');
      } else {
        setXrayTests(xrayData.map(item => item.name));
      }

      // Fetch USG tests
      const { data: usgData, error: usgError } = await supabase
        .from('investigation')
        .select('name, type')
        .eq('type', 'USG')
        .order('name');

      if (usgError) {
        console.error('Error fetching USG tests:', usgError);
        showPopup('Error fetching USG tests', 'error');
      } else {
        setUsgTests(usgData.map(item => item.name));
      }

    } catch (error) {
      console.error('Error in fetchInvestigationTests:', error);
      showPopup('Error loading investigation tests', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load data from Supabase
  const loadData = async () => {
    try {
      setLoading(true);

      // Load pending indents (status = 'pending')
      const { data: pendingData, error: pendingError } = await supabase
        .from('pharmacy')
        .select('*')
        .not('planned1', 'is', null)
        .is('actual1', null)
        .eq('status', 'pending')
        .order('timestamp', { ascending: false });

      if (pendingError) throw pendingError;

      const formattedPending = (pendingData || []).map(indent => ({
        id: indent.id,
        indentNumber: indent.indent_no,
        admissionNumber: indent.admission_number,
        ipdNumber: indent.ipd_number,
        staffName: indent.staff_name,
        consultantName: indent.consultant_name,
        patientName: indent.patient_name,
        uhidNumber: indent.uhid_number,
        age: indent.age,
        gender: indent.gender,
        wardLocation: indent.ward_location,
        category: indent.category,
        room: indent.room,
        diagnosis: indent.diagnosis,
        requestTypes: parseJsonField(indent.request_types),
        medicines: parseJsonField(indent.medicines) || [],
        investigations: parseJsonField(indent.investigations) || [],
        investigationAdvice: parseJsonField(indent.investigation_advice),
        timestamp: indent.timestamp,
        status: indent.status,
        planned1: indent.planned1 // Add planned1
      }));

      setPendingIndents(formattedPending);

      // Load history indents (status = 'approved' or 'rejected')
      const { data: historyData, error: historyError } = await supabase
        .from('pharmacy')
        .select('*')
        .not('actual1', 'is', null)
        .not('planned1', 'is', null)
        .in('status', ['approved', 'rejected'])
        .order('actual1', { ascending: false });

      if (historyError) throw historyError;

      const formattedHistory = (historyData || []).map(indent => ({
        id: indent.id,
        indentNumber: indent.indent_no,
        admissionNumber: indent.admission_number,
        ipdNumber: indent.ipd_number,
        staffName: indent.staff_name,
        consultantName: indent.consultant_name,
        patientName: indent.patient_name,
        uhidNumber: indent.uhid_number,
        age: indent.age,
        gender: indent.gender,
        wardLocation: indent.ward_location,
        category: indent.category,
        room: indent.room,
        diagnosis: indent.diagnosis,
        requestTypes: parseJsonField(indent.request_types),
        medicines: parseJsonField(indent.medicines) || [],
        investigations: parseJsonField(indent.investigations) || [],
        investigationAdvice: parseJsonField(indent.investigation_advice),
        timestamp: indent.timestamp,
        status: indent.status,
        slipImage: indent.slip_image,
        slipImageUrl: indent.slip_image_url,
        approvedAt: indent.approved_at,
        rejectedAt: indent.rejected_at,
        approvedBy: indent.approved_by,
        updatedAt: indent.updated_at,
        planned1: indent.planned1, // Add planned1
        actual1: indent.actual1 // Add actual1
      }));

      setHistoryIndents(formattedHistory);

      // Extract unique patient names
      const allPatients = [...formattedPending, ...formattedHistory].map(r => r.patientName).filter(Boolean);
      setPatientNames([...new Set(allPatients)].sort());

    } catch (error) {
      console.error('Error loading data:', error);
      showPopup(`Error loading data: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Setup realtime subscription and initial data load
  useEffect(() => {
    loadData();
    fetchInvestigationTests();

    const channel = supabase
      .channel('pharmacy_approval_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pharmacy'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Handle status dropdown change
  const handleStatusChange = (indentId, indentNumber, status) => {
    setStatusChanges(prev => ({
      ...prev,
      [indentId]: { status, indentNumber }
    }));
  };

  // Upload slip image to Supabase Storage
  const uploadSlipToStorage = async (slipImageBase64, indentNumber) => {
    try {
      // Convert base64 to blob
      const base64Response = await fetch(slipImageBase64);
      const blob = await base64Response.blob();

      // Create a file from blob
      const fileName = `pharmacy_slip_${indentNumber}_${Date.now()}.png`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('slip_image')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) {
        console.error('Error uploading to storage:', error);
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('slip_image')
        .getPublicUrl(fileName);

      return publicUrl;

    } catch (error) {
      console.error('Error in uploadSlipToStorage:', error);
      return null;
    }
  };

  // Save status changes to Supabase
  const handleSaveStatusChanges = async () => {
    if (Object.keys(statusChanges).length === 0) {
      showPopup('No changes to save', 'warning');
      return;
    }

    try {
      setLoading(true);

      // Process each status change
      for (const [id, { status, indentNumber }] of Object.entries(statusChanges)) {
        const indent = pendingIndents.find(p => p.id === parseInt(id));
        const updateData = {
          status: status.toLowerCase(),
          actual1: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),
          planned2: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),
        };

        if (status === 'Approved') {
          const user = JSON.parse(localStorage.getItem("mis_user"));
          updateData.approved_by = user?.name || 'Unknown';

          // Generate slip image
          const slipImageBase64 = generateSlipImage(indent);

          // Then upload to storage and update with URL
          try {
            const slipImageUrl = await uploadSlipToStorage(slipImageBase64, indentNumber);
            if (slipImageUrl) {
              updateData.slip_image = slipImageUrl;
            }
          } catch (uploadError) {
            console.error('Failed to upload slip to storage:', uploadError);
            // Continue even if storage upload fails
          }
        }

        // Update the database
        const { error } = await supabase
          .from('pharmacy')
          .update(updateData)
          .eq('id', id);

        if (error) {
          console.error(`Error updating indent ${id}:`, error);
          throw new Error(`Failed to update indent ${indentNumber}`);
        }
      }

      // Clear status changes
      setStatusChanges({});

      // Reload data
      await loadData();

      showNotification(`${Object.keys(statusChanges).length} indent(s) processed successfully!`, 'success');

    } catch (error) {
      console.error('Error saving status changes:', error);
      showPopup(`Failed to save status changes: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate slip image (same as before)
  const generateSlipImage = (indent) => {
    const userStr = localStorage.getItem("mis_user");
    const user = JSON.parse(userStr);
    const username = user.name;


    const canvas = document.createElement('canvas');
    canvas.width = 850;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');

    // Yellow background
    ctx.fillStyle = '#FFEB3B';
    ctx.fillRect(0, 0, 850, 1100);

    // Draw main border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 830, 1080);

    let y = 10;

    // Header - Hospital Name
    ctx.strokeRect(10, y, 830, 40);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MAMTA SUPERSPECIALITY HOSPITAL', 425, y + 27);

    // Subheader - Location
    y += 40;
    ctx.strokeRect(10, y, 830, 25);
    ctx.font = '14px Arial';
    ctx.fillText('Dubey Colony Mowa, Raipur (C.G)', 425, y + 17);

    // Row 1: Indent No, Date, Request Type
    y += 25;
    ctx.strokeRect(10, y, 830, 25);
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Indent No:', 20, y + 17);
    ctx.fillStyle = '#FF0000';
    ctx.font = '12px Arial';
    ctx.fillText(indent.indentNumber, 80, y + 17);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Date:', 300, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(new Date().toLocaleDateString('en-GB'), 335, y + 17);

    ctx.font = 'bold 12px Arial';
    ctx.fillText('Request Type:', 520, y + 17);
    ctx.fillStyle = '#FF0000';
    ctx.font = '12px Arial';
    let requestTypes = [];
    if (indent.requestTypes.medicineSlip) requestTypes.push('Medicine Slip');
    if (indent.requestTypes.investigation) requestTypes.push('Investigation');
    if (indent.requestTypes.package) requestTypes.push('Package');
    if (indent.requestTypes.nonPackage) requestTypes.push('Non-Package');
    ctx.fillText(requestTypes.join(', '), 620, y + 17);

    // Row 2: Patient Name, Age, Gender
    y += 25;
    ctx.strokeRect(10, y, 830, 25);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Patient Name:', 20, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(indent.patientName.toUpperCase(), 110, y + 17);

    ctx.font = 'bold 12px Arial';
    ctx.fillText('Age:', 480, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(indent.age.toString(), 510, y + 17);

    ctx.font = 'bold 12px Arial';
    ctx.fillText('Gender:', 620, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(indent.gender, 675, y + 17);

    // Row 3: UHID, Diagnosis, Ward Type
    y += 25;
    ctx.strokeRect(10, y, 830, 25);
    ctx.font = 'bold 12px Arial';
    ctx.fillText('UHID No:', 20, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(indent.uhidNumber, 75, y + 17);

    ctx.font = 'bold 12px Arial';
    ctx.fillText('Diagnosis:', 250, y + 17);
    ctx.fillStyle = '#FF0000';
    ctx.font = '12px Arial';
    ctx.fillText(indent.diagnosis, 325, y + 17);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Ward Type:', 620, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(indent.room, 695, y + 17);

    // Row 4: Consultant, Nursing Staff, Category
    y += 25;
    ctx.strokeRect(10, y, 830, 25);
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Consultant Name:', 20, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(indent.consultantName, 135, y + 17);

    ctx.font = 'bold 12px Arial';
    ctx.fillText('Nursing Staff:', 380, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(indent.staffName, 470, y + 17);

    ctx.font = 'bold 12px Arial';
    ctx.fillText('Category:', 650, y + 17);
    ctx.font = '12px Arial';
    ctx.fillText(indent.category, 720, y + 17);

    y += 25;

    // Medicine Slip Section
    if (indent.requestTypes.medicineSlip && indent.medicines.length > 0) {
      // Medicine Table Header
      ctx.strokeRect(10, y, 830, 30);
      ctx.fillStyle = '#FFEB3B';
      ctx.fillRect(10, y, 830, 30);

      // Column headers
      ctx.strokeRect(10, y, 80, 30); // Serial Number
      ctx.strokeRect(90, y, 520, 30); // Medicine Name
      ctx.strokeRect(610, y, 230, 30); // Quantity

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SN', 50, y + 20);
      ctx.fillText('Medicine Name', 350, y + 20);
      ctx.fillText('Quantity', 725, y + 20);

      // Medicine rows
      y += 30;
      const rowHeight = 25;
      indent.medicines.forEach((med, index) => {
        ctx.strokeRect(10, y, 80, rowHeight);
        ctx.strokeRect(90, y, 520, rowHeight);
        ctx.strokeRect(610, y, 230, rowHeight);

        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((index + 1).toString(), 50, y + 17);
        ctx.textAlign = 'left';
        ctx.fillText(med.name.toUpperCase(), 100, y + 17);
        ctx.textAlign = 'center';
        ctx.fillText(med.quantity.toString(), 725, y + 17);

        y += rowHeight;
      });

      // Add empty rows to maintain consistent height (total 15 rows)
      const emptyRows = Math.max(0, 15 - indent.medicines.length);
      for (let i = 0; i < emptyRows; i++) {
        ctx.strokeRect(10, y, 80, rowHeight);
        ctx.strokeRect(90, y, 520, rowHeight);
        ctx.strokeRect(610, y, 230, rowHeight);
        y += rowHeight;
      }
    }

    // Investigation Advice Section
    if (indent.requestTypes.investigation && indent.investigationAdvice) {
      // Investigation header
      ctx.strokeRect(10, y, 830, 30);
      ctx.fillStyle = '#FFEB3B';
      ctx.fillRect(10, y, 830, 30);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('INVESTIGATION ADVICE', 425, y + 20);

      y += 30;

      // Category and Priority row
      ctx.strokeRect(10, y, 830, 25);
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Category:', 20, y + 17);
      ctx.font = '12px Arial';
      ctx.fillText(indent.investigationAdvice.adviceCategory, 90, y + 17);

      ctx.font = 'bold 12px Arial';
      ctx.fillText('Priority:', 400, y + 17);
      ctx.font = '12px Arial';
      ctx.fillText(indent.investigationAdvice.priority, 460, y + 17);

      y += 25;

      // Pathology Tests
      if (indent.investigationAdvice.adviceCategory === 'Pathology' &&
        indent.investigationAdvice.pathologyTests?.length > 0) {
        ctx.strokeRect(10, y, 830, 25);
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Pathology Tests:', 20, y + 17);
        y += 25;

        // List tests with proper wrapping
        const testsText = indent.investigationAdvice.pathologyTests.join(', ');
        ctx.strokeRect(10, y, 830, 100);
        ctx.font = '11px Arial';

        const words = testsText.split(' ');
        let line = '';
        let lineY = y + 15;
        const maxWidth = 800;

        words.forEach(word => {
          const testLine = line + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, 20, lineY);
            line = word + ' ';
            lineY += 15;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line, 20, lineY);
        y += 100;
      }

      // Radiology Tests
      if (indent.investigationAdvice.adviceCategory === 'Radiology' &&
        indent.investigationAdvice.radiologyTests?.length > 0) {
        ctx.strokeRect(10, y, 830, 25);
        ctx.font = 'bold 12px Arial';
        ctx.fillText(`${indent.investigationAdvice.radiologyType} Tests:`, 20, y + 17);
        y += 25;

        // List tests
        const testsText = indent.investigationAdvice.radiologyTests.join(', ');
        ctx.strokeRect(10, y, 830, 100);
        ctx.font = '11px Arial';

        const words = testsText.split(' ');
        let line = '';
        let lineY = y + 15;
        const maxWidth = 800;

        words.forEach(word => {
          const testLine = line + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, 20, lineY);
            line = word + ' ';
            lineY += 15;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line, 20, lineY);
        y += 100;
      }

      // Remarks
      if (indent.investigationAdvice.remarks) {
        ctx.strokeRect(10, y, 830, 25);
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Remarks:', 20, y + 17);
        y += 25;

        ctx.strokeRect(10, y, 830, 60);
        ctx.font = '11px Arial';
        ctx.fillText(indent.investigationAdvice.remarks, 20, y + 15);
        y += 60;
      }
    }

    // Move to footer position (always at bottom)
    y = 1050;

    // Footer - Prepared By and Approved By
    ctx.strokeRect(10, y, 415, 40);
    ctx.strokeRect(425, y, 415, 40);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Prepared By', 20, y + 15);
    ctx.font = '11px Arial';
    ctx.fillText("Nikhil", 20, y + 32);

    ctx.font = 'bold 12px Arial';
    ctx.fillText('Approved By', 435, y + 15);
    ctx.font = '11px Arial';
    ctx.fillText(username || 'Pharmacy', 435, y + 32);

    return canvas.toDataURL('image/png');
  };

  const handleView = (indent) => {
    setSelectedIndent(indent);
    setViewModal(true);
  };

  const handleEdit = (indent) => {
    setSelectedIndent(indent);

    // Clone medicines to ensure they have IDs for editing
    const medicinesWithIds = (indent.medicines || []).map((med, index) => ({
      ...med,
      id: med.id || Date.now() + index // Ensure each medicine has an ID
    }));

    setEditFormData({
      ...indent,
      medicines: medicinesWithIds,
      investigationAdvice: indent.investigationAdvice ? { ...indent.investigationAdvice } : {
        priority: 'Medium',
        adviceCategory: '',
        pathologyTests: [],
        radiologyType: '',
        radiologyTests: [],
        remarks: ''
      }
    });
    setEditModal(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addMedicine = () => {
    const newMedicine = {
      id: Date.now(),
      name: '',
      quantity: ''
    };
    setEditFormData(prev => ({
      ...prev,
      medicines: [...prev.medicines, newMedicine]
    }));
  };

  const removeMedicine = (id) => {
    setEditFormData(prev => ({
      ...prev,
      medicines: prev.medicines.filter(med => med.id !== id)
    }));
  };

  const updateMedicine = (id, field, value) => {
    setEditFormData(prev => ({
      ...prev,
      medicines: prev.medicines.map(med =>
        med.id === id ? { ...med, [field]: value } : med
      )
    }));
  };

  const handleInvestigationAdviceChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      investigationAdvice: {
        ...prev.investigationAdvice,
        [name]: value,
        ...(name === 'adviceCategory' && {
          pathologyTests: [],
          radiologyType: '',
          radiologyTests: []
        }),
        ...(name === 'radiologyType' && { radiologyTests: [] })
      }
    }));
  };

  const handleAdviceCheckboxChange = (testName, category) => {
    setEditFormData(prev => {
      const currentTests = category === 'pathology'
        ? prev.investigationAdvice.pathologyTests
        : prev.investigationAdvice.radiologyTests;

      const newTests = currentTests.includes(testName)
        ? currentTests.filter(t => t !== testName)
        : [...currentTests, testName];

      return {
        ...prev,
        investigationAdvice: {
          ...prev.investigationAdvice,
          [category === 'pathology' ? 'pathologyTests' : 'radiologyTests']: newTests
        }
      };
    });
  };

  const getRadiologyTests = () => {
    if (!editFormData?.investigationAdvice) return [];
    switch (editFormData.investigationAdvice.radiologyType) {
      case 'X-ray': return xrayTests;
      case 'CT-scan': return ctScanTests;
      case 'USG': return usgTests;
      default: return [];
    }
  };

  const handleSaveEdit = async () => {
    if (!editFormData.diagnosis) {
      showPopup('Please enter Diagnosis', 'warning');
      return;
    }

    if (editFormData.requestTypes.medicineSlip && editFormData.medicines.length === 0) {
      showPopup('Please add at least one medicine', 'warning');
      return;
    }

    const incompleteMedicines = editFormData.medicines.some(med => !med.name || !med.quantity);
    if (editFormData.requestTypes.medicineSlip && incompleteMedicines) {
      showPopup('Please fill all medicine details', 'warning');
      return;
    }

    try {
      setLoading(true);

      const updateData = {
        diagnosis: editFormData.diagnosis,
        medicines: JSON.stringify(editFormData.medicines),
        investigation_advice: JSON.stringify(editFormData.investigationAdvice),
        // updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('pharmacy')
        .update(updateData)
        .eq('id', editFormData.id);

      if (error) throw error;

      // Refresh data
      await loadData();

      setEditModal(false);
      setEditFormData(null);
      setSelectedIndent(null);

      showPopup('Indent updated successfully!', 'success');

    } catch (error) {
      console.error('Error updating indent:', error);
      showPopup(`Failed to update indent: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSlip = (indent) => {
    setSelectedIndent(indent);
    setSlipModal(true);
  };

  const downloadSlip = async (indent) => {
    try {
      let imageUrl = indent.slipImage;

      // If we have a storage URL, try to use it
      if (indent.slipImageUrl) {
        imageUrl = indent.slipImageUrl;
      }

      const link = document.createElement('a');
      link.download = `Pharmacy_Slip_${indent.indentNumber}.png`;
      link.href = imageUrl;
      link.click();

      showPopup('Slip downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error downloading slip:', error);
      showPopup('Failed to download slip', 'error');
    }
  };

  // Filter Logic
  const applyFilters = (records) => {
    return records.filter(record => {
      const matchesPatient = selectedPatient ? record.patientName === selectedPatient : true;
      let matchesDate = true;
      if (selectedDate && record.planned1) {
        const recordDate = new Date(record.planned1).toLocaleDateString();
        const filterDate = new Date(selectedDate).toLocaleDateString();
        matchesDate = recordDate === filterDate;
      }
      return matchesPatient && matchesDate;
    });
  };

  const filteredPendingIndents = applyFilters(pendingIndents);
  const filteredHistoryIndents = applyFilters(historyIndents);

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Fixed Section: Header, Tabs, and Filters */}
      <div className="flex-none shrink-0 border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Pharmacy Approval</h1>
              <p className="hidden sm:block text-sm text-gray-600 mt-0.5">Review and approve pharmacy indent requests</p>
            </div>

            {/* Submit Button - Only if changes exist and in pending tab */}
            {activeTab === 'pending' && Object.keys(statusChanges).length > 0 && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setStatusChanges({})}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStatusChanges}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  disabled={loading}
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {/* Tabs and Filters Section - Compact */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div className="flex gap-4 w-full lg:w-auto border-b lg:border-none border-gray-100 pb-2 lg:pb-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('pending')}
                className={`pb-2 lg:pb-0 px-1 whitespace-nowrap text-sm ${activeTab === 'pending'
                  ? 'border-b-2 border-green-500 text-green-600 font-bold'
                  : 'text-gray-500 hover:text-gray-700 font-medium'
                  }`}
              >
                Pending ({filteredPendingIndents.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-2 lg:pb-0 px-1 whitespace-nowrap text-sm ${activeTab === 'history'
                  ? 'border-b-2 border-green-500 text-green-600 font-bold'
                  : 'text-gray-500 hover:text-gray-700 font-medium'
                  }`}
              >
                History ({filteredHistoryIndents.length})
              </button>
            </div>

            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="flex-1 lg:flex-none px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">All Patients</option>
                {patientNames.map((name, index) => (
                  <option key={index} value={name}>{name}</option>
                ))}
              </select>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 lg:flex-none px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />

              {(selectedPatient || selectedDate) && (
                <button
                  onClick={() => {
                    setSelectedPatient('');
                    setSelectedDate('');
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden p-3 md:p-4">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {/* Loading State */}
          {loading && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-blue-800 font-medium">Loading data...</span>
            </div>
          )}

          {/* Pending Section */}
          {activeTab === 'pending' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Desktop Table - Scrollable Container */}
              <div className="hidden md:block flex-1 overflow-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                  <thead className="bg-green-600 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Select</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Indent No</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Admission No</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Patient Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">UHID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Staff Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Diagnosis</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Request Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Planned</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredPendingIndents.length > 0 ? (
                      filteredPendingIndents.map((indent) => (
                        <tr key={indent.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={!!statusChanges[indent.id]}
                              onChange={(e) => {
                                if (!e.target.checked) {
                                  const newChanges = { ...statusChanges };
                                  delete newChanges[indent.id];
                                  setStatusChanges(newChanges);
                                } else {
                                  handleStatusChange(indent.id, indent.indentNumber, 'Approved');
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              disabled={loading}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={statusChanges[indent.id]?.status || ''}
                              onChange={(e) => handleStatusChange(indent.id, indent.indentNumber, e.target.value)}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              disabled={loading}
                            >
                              <option value="">Select Status</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-green-700">{indent.indentNumber}</td>
                          <td className="px-6 py-4 text-sm">{indent.admissionNumber}</td>
                          <td className="px-6 py-4 text-sm">{indent.patientName}</td>
                          <td className="px-6 py-4 text-sm">{indent.uhidNumber}</td>
                          <td className="px-6 py-4 text-sm">{indent.staffName}</td>
                          <td className="px-6 py-4 text-sm">{indent.diagnosis}</td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {indent.requestTypes.medicineSlip && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Medicine</span>
                              )}
                              {indent.requestTypes.investigation && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Investigation</span>
                              )}
                              {indent.requestTypes.package && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">Package</span>
                              )}
                              {indent.requestTypes.nonPackage && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">Non-Package</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                            {indent.planned1 ? new Date(indent.planned1).toLocaleString('en-GB', {
                              hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                            }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleView(indent)}
                                className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                title="View Details"
                                disabled={loading}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(indent)}
                                className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                                title="Edit Indent"
                                disabled={loading}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center">
                          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                          <p className="text-gray-500 font-medium">No pending indents</p>
                          <p className="text-gray-400 text-sm mt-1">All indents have been processed</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for Pending - Scrollable Container */}
              <div className="md:hidden flex-1 overflow-auto space-y-4">
                {filteredPendingIndents.length > 0 ? (
                  filteredPendingIndents.map((indent) => (
                    <div key={indent.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!statusChanges[indent.id]}
                            onChange={(e) => {
                              if (!e.target.checked) {
                                const newChanges = { ...statusChanges };
                                delete newChanges[indent.id];
                                setStatusChanges(newChanges);
                              } else {
                                handleStatusChange(indent.id, indent.indentNumber, 'Approved');
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            disabled={loading}
                          />
                          <div>
                            <span className="text-green-700 font-semibold">{indent.indentNumber}</span>
                            <p className="text-xs text-gray-500 mt-0.5">{indent.admissionNumber}</p>
                          </div>
                        </div>
                        <select
                          value={statusChanges[indent.id]?.status || ''}
                          onChange={(e) => handleStatusChange(indent.id, indent.indentNumber, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-green-500 w-24"
                          disabled={loading}
                        >
                          <option value="">Status</option>
                          <option value="Approved">Approve</option>
                          <option value="Rejected">Reject</option>
                        </select>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Patient:</span>
                          <span className="font-medium text-gray-900">{indent.patientName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Diagnosis:</span>
                          <span className="font-medium text-gray-900 text-right truncate max-w-[150px]">{indent.diagnosis}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned:</span>
                          <span className="font-medium text-gray-900">
                            {indent.planned1 ? new Date(indent.planned1).toLocaleString('en-GB', {
                              hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                            }) : '-'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-1">
                          {indent.requestTypes.medicineSlip && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Medicine</span>
                          )}
                          {indent.requestTypes.investigation && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Investigation</span>
                          )}
                          {indent.requestTypes.package && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">Package</span>
                          )}
                          {indent.requestTypes.nonPackage && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">Non-Package</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleView(indent)}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors flex-1 flex justify-center"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(indent)}
                          className="p-2 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-colors flex-1 flex justify-center"
                          title="Edit Indent"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-white rounded-lg shadow">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No pending indents</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Section */}
          {activeTab === 'history' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Desktop Table - Scrollable Container */}
              <div className="hidden md:block flex-1 overflow-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                  <thead className="bg-green-600 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Indent No</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Admission No</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Patient Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">UHID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Staff Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Diagnosis</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Request Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Planned</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Actual</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white bg-green-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredHistoryIndents.length > 0 ? (
                      filteredHistoryIndents.map((indent) => (
                        <tr key={indent.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-green-700">{indent.indentNumber}</td>
                          <td className="px-6 py-4 text-sm">{indent.admissionNumber}</td>
                          <td className="px-6 py-4 text-sm">{indent.patientName}</td>
                          <td className="px-6 py-4 text-sm">{indent.uhidNumber}</td>
                          <td className="px-6 py-4 text-sm">{indent.staffName}</td>
                          <td className="px-6 py-4 text-sm">{indent.diagnosis}</td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {indent.requestTypes.medicineSlip && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Medicine</span>
                              )}
                              {indent.requestTypes.investigation && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Investigation</span>
                              )}
                              {indent.requestTypes.package && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">Package</span>
                              )}
                              {indent.requestTypes.nonPackage && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">Non-Package</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.status === 'approved' ? (
                              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                Approved
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                            {indent.planned1 ? new Date(indent.planned1).toLocaleString('en-GB', {
                              hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                            }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                            {indent.actual1 ? new Date(indent.actual1).toLocaleString('en-GB', {
                              hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                            }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleView(indent)}
                                className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                title="View Details"
                                disabled={loading}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {indent.status === 'approved' && (indent.slipImage || indent.slipImageUrl) && (
                                <button
                                  onClick={() => handleViewSlip(indent)}
                                  className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                  title="View Slip"
                                  disabled={loading}
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center">
                          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                          <p className="text-gray-500 font-medium">No history yet</p>
                          <p className="text-gray-400 text-sm mt-1">Approved and rejected indents will appear here</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for History - Scrollable Container */}
              <div className="md:hidden flex-1 overflow-auto space-y-4">
                {filteredHistoryIndents.length > 0 ? (
                  filteredHistoryIndents.map((indent) => (
                    <div key={indent.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-green-700 font-semibold">{indent.indentNumber}</span>
                          <p className="text-xs text-gray-500 mt-0.5">{indent.admissionNumber}</p>
                        </div>
                        {indent.status === 'approved' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                            Approved
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                            Rejected
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Patient:</span>
                          <span className="font-medium text-gray-900">{indent.patientName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned:</span>
                          <span className="font-medium text-gray-900">
                            {indent.planned1 ? new Date(indent.planned1).toLocaleString('en-GB', {
                              hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                            }) : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Actual:</span>
                          <span className="font-medium text-gray-900">
                            {indent.actual1 ? new Date(indent.actual1).toLocaleString('en-GB', {
                              hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                            }) : '-'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-1">
                          {indent.requestTypes.medicineSlip && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Medicine</span>
                          )}
                          {indent.requestTypes.investigation && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Investigation</span>
                          )}
                          {indent.requestTypes.package && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">Package</span>
                          )}
                          {indent.requestTypes.nonPackage && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">Non-Package</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleView(indent)}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors flex-1 flex justify-center"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {indent.status === 'approved' && (indent.slipImage || indent.slipImageUrl) && (
                          <button
                            onClick={() => handleViewSlip(indent)}
                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors flex-1 flex justify-center"
                            title="View Slip"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-white rounded-lg shadow">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No history yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {
        editModal && editFormData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-amber-600 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Edit Indent - {editFormData.indentNumber}</h2>
                <button
                  onClick={() => {
                    setEditModal(false);
                    setEditFormData(null);
                  }}
                  className="text-white hover:bg-amber-700 rounded-full p-1"
                  disabled={loading}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Patient Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Patient Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Admission Number</p>
                      <p className="font-medium">{editFormData.admissionNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Patient Name</p>
                      <p className="font-medium">{editFormData.patientName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">UHID Number</p>
                      <p className="font-medium">{editFormData.uhidNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Diagnosis <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="diagnosis"
                        value={editFormData.diagnosis}
                        onChange={handleEditInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Enter diagnosis"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Medicines Section */}
                {editFormData.requestTypes.medicineSlip && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Medicines</h3>
                    </div>

                    <div className="space-y-3 mb-4">
                      {editFormData.medicines.map((medicine, index) => (
                        <div key={medicine.id} className="flex gap-3 items-end">
                          <div className="w-8 h-10 flex items-center justify-center bg-green-600 text-white rounded font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name</label>
                            <MedicineDropdown
                              medicine={medicine}
                              onUpdate={updateMedicine}
                              index={index}
                              loading={loading}
                            />
                          </div>
                          <div className="w-32">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={medicine.quantity}
                              onChange={(e) => updateMedicine(medicine.id, 'quantity', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              placeholder="0"
                              disabled={loading}
                            />
                          </div>
                          <button
                            onClick={() => removeMedicine(medicine.id)}
                            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg h-10 disabled:bg-red-300"
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={addMedicine}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm w-full justify-center disabled:bg-green-300"
                      disabled={loading}
                    >
                      <Plus className="w-4 h-4" />
                      Add Medicine
                    </button>
                  </div>
                )}

                {/* Investigation Advice Section */}
                {editFormData.requestTypes.investigation && editFormData.investigationAdvice && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Investigation Advice</h3>

                    <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
                          <select
                            name="priority"
                            value={editFormData.investigationAdvice.priority}
                            onChange={handleInvestigationAdviceChange}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                            disabled={loading}
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pathology & Radiology *</label>
                          <select
                            name="adviceCategory"
                            value={editFormData.investigationAdvice.adviceCategory}
                            onChange={handleInvestigationAdviceChange}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                            disabled={loading}
                          >
                            <option value="">Select Category</option>
                            <option value="Pathology">Pathology</option>
                            <option value="Radiology">Radiology</option>
                          </select>
                        </div>
                      </div>

                      {/* Pathology Tests */}
                      {editFormData.investigationAdvice.adviceCategory === 'Pathology' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Pathology Tests * ({editFormData.investigationAdvice.pathologyTests.length} selected)
                          </label>
                          <div className="p-4 max-h-60 overflow-y-auto bg-white rounded-lg border border-gray-300">
                            {pathologyTests.length > 0 ? (
                              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                {pathologyTests.map((test) => (
                                  <label key={test} className="flex items-start gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editFormData.investigationAdvice.pathologyTests.includes(test)}
                                      onChange={() => handleAdviceCheckboxChange(test, 'pathology')}
                                      className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                      disabled={loading}
                                    />
                                    <span className="text-sm text-gray-700">{test}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center text-gray-500 py-8">
                                <p>Loading pathology tests...</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Radiology Section */}
                      {editFormData.investigationAdvice.adviceCategory === 'Radiology' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Radiology Type *</label>
                            <select
                              name="radiologyType"
                              value={editFormData.investigationAdvice.radiologyType}
                              onChange={handleInvestigationAdviceChange}
                              className="w-full px-3 py-2 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                              disabled={loading}
                            >
                              <option value="">Select Type</option>
                              <option value="X-ray">X-ray</option>
                              <option value="CT-scan">CT Scan</option>
                              <option value="USG">USG</option>
                            </select>
                          </div>

                          {editFormData.investigationAdvice.radiologyType && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select {editFormData.investigationAdvice.radiologyType} Tests * ({editFormData.investigationAdvice.radiologyTests.length} selected)
                              </label>
                              <div className="p-4 max-h-60 overflow-y-auto bg-white rounded-lg border border-gray-300">
                                {(() => {
                                  const tests = getRadiologyTests();
                                  return tests.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                      {tests.map((test) => (
                                        <label key={test} className="flex items-start gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={editFormData.investigationAdvice.radiologyTests.includes(test)}
                                            onChange={() => handleAdviceCheckboxChange(test, 'radiology')}
                                            className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                            disabled={loading}
                                          />
                                          <span className="text-sm text-gray-700">{test}</span>
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center text-gray-500 py-8">
                                      <p>Loading {editFormData.investigationAdvice.radiologyType} tests...</p>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Remarks */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                        <textarea
                          name="remarks"
                          value={editFormData.investigationAdvice.remarks}
                          onChange={handleInvestigationAdviceChange}
                          rows="3"
                          placeholder="Add any additional notes or instructions..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button
                    onClick={() => {
                      setEditModal(false);
                      setEditFormData(null);
                    }}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium disabled:bg-gray-100"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:bg-green-300"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* View Details Modal */}
      {
        viewModal && selectedIndent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-green-600 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Indent Details - {selectedIndent.indentNumber}</h2>
                <button
                  onClick={() => {
                    setViewModal(false);
                    setSelectedIndent(null);
                  }}
                  className="text-white hover:bg-green-700 rounded-full p-1"
                  disabled={loading}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Patient Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Patient Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Admission Number</p>
                      <p className="font-medium">{selectedIndent.admissionNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Patient Name</p>
                      <p className="font-medium">{selectedIndent.patientName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">UHID Number</p>
                      <p className="font-medium">{selectedIndent.uhidNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Age</p>
                      <p className="font-medium">{selectedIndent.age}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Gender</p>
                      <p className="font-medium">{selectedIndent.gender}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Category</p>
                      <p className="font-medium">{selectedIndent.category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room</p>
                      <p className="font-medium">{selectedIndent.room}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Ward Location</p>
                      <p className="font-medium">{selectedIndent.wardLocation}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Staff Name</p>
                      <p className="font-medium">{selectedIndent.staffName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Consultant Name</p>
                      <p className="font-medium">{selectedIndent.consultantName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Diagnosis</p>
                      <p className="font-medium">{selectedIndent.diagnosis}</p>
                    </div>
                  </div>
                </div>

                {/* Request Types */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Request Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedIndent.requestTypes.medicineSlip && (
                      <span className="px-3 py-2 bg-green-100 text-green-700 text-sm rounded-lg font-medium">Medicine Slip</span>
                    )}
                    {selectedIndent.requestTypes.investigation && (
                      <span className="px-3 py-2 bg-green-100 text-green-700 text-sm rounded-lg font-medium">Investigation</span>
                    )}
                    {selectedIndent.requestTypes.package && (
                      <span className="px-3 py-2 bg-purple-100 text-purple-700 text-sm rounded-lg font-medium">Package</span>
                    )}
                    {selectedIndent.requestTypes.nonPackage && (
                      <span className="px-3 py-2 bg-orange-100 text-orange-700 text-sm rounded-lg font-medium">Non-Package</span>
                    )}
                  </div>
                </div>

                {/* Medicines */}
                {selectedIndent.requestTypes.medicineSlip && selectedIndent.medicines.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Medicines</h3>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-green-600 text-white">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Medicine Name</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {selectedIndent.medicines.map((medicine, index) => (
                            <tr key={medicine.id || index}>
                              <td className="px-4 py-3 text-sm">{index + 1}</td>
                              <td className="px-4 py-3 text-sm font-medium">{medicine.name}</td>
                              <td className="px-4 py-3 text-sm">{medicine.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Investigation Advice */}
                {selectedIndent.requestTypes.investigation && selectedIndent.investigationAdvice && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Investigation Advice</h3>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Priority:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedIndent.investigationAdvice.priority === 'High' ? 'bg-red-100 text-red-700' :
                            selectedIndent.investigationAdvice.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                            {selectedIndent.investigationAdvice.priority}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Category:</span>
                          <div className="font-medium text-gray-900 mt-1">{selectedIndent.investigationAdvice.adviceCategory}</div>
                        </div>

                        {selectedIndent.investigationAdvice.adviceCategory === 'Pathology' && selectedIndent.investigationAdvice.pathologyTests?.length > 0 && (
                          <div>
                            <span className="text-gray-600">Pathology Tests ({selectedIndent.investigationAdvice.pathologyTests.length}):</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedIndent.investigationAdvice.pathologyTests.map((test, index) => (
                                <span key={index} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                  {test}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedIndent.investigationAdvice.adviceCategory === 'Radiology' && (
                          <>
                            <div>
                              <span className="text-gray-600">Radiology Type:</span>
                              <div className="font-medium text-gray-900 mt-1">{selectedIndent.investigationAdvice.radiologyType}</div>
                            </div>
                            {selectedIndent.investigationAdvice.radiologyTests?.length > 0 && (
                              <div>
                                <span className="text-gray-600">Tests ({selectedIndent.investigationAdvice.radiologyTests.length}):</span>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {selectedIndent.investigationAdvice.radiologyTests.map((test, index) => (
                                    <span key={index} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                                      {test}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {selectedIndent.investigationAdvice.remarks && (
                          <div>
                            <span className="text-gray-600">Remarks:</span>
                            <div className="font-medium text-gray-900 mt-1 p-2 bg-white rounded border border-gray-200">
                              {selectedIndent.investigationAdvice.remarks}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status */}
                {selectedIndent.status && selectedIndent.status !== 'pending' && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Status</h3>
                    <div className="flex items-center gap-4">
                      <span className={`px-4 py-2 rounded-lg font-medium ${selectedIndent.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {selectedIndent.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                      {selectedIndent.approvedAt && (
                        <span className="text-sm text-gray-500">
                          on {new Date(selectedIndent.approvedAt).toLocaleString()}
                        </span>
                      )}
                      {selectedIndent.rejectedAt && (
                        <span className="text-sm text-gray-500">
                          on {new Date(selectedIndent.rejectedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-6 border-t">
                  <button
                    onClick={() => {
                      setViewModal(false);
                      setSelectedIndent(null);
                    }}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Slip View Modal */}
      {
        slipModal && selectedIndent && (selectedIndent.slipImage || selectedIndent.slipImageUrl) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-green-600 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Pharmacy Slip - {selectedIndent.indentNumber}</h2>
                <button
                  onClick={() => {
                    setSlipModal(false);
                    setSelectedIndent(null);
                  }}
                  className="text-white hover:bg-green-700 rounded-full p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="bg-gray-100 p-4 rounded-lg mb-4">
                  <img
                    src={selectedIndent.slipImageUrl || selectedIndent.slipImage}
                    alt="Pharmacy Slip"
                    className="w-full rounded border border-gray-300"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => downloadSlip(selectedIndent)}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download Slip
                  </button>
                  <button
                    onClick={() => {
                      setSlipModal(false);
                      setSelectedIndent(null);
                    }}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default PharmacyApproval;