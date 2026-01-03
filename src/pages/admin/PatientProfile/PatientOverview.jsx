import React, { useState, useEffect } from 'react';
import {
    Calendar,
    User,
    Stethoscope,
    Activity,
    Bed,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import supabase from '../../../SupabaseClient'; // Adjust path as needed

// Status Badge Component
const StatusBadge = ({ status }) => {
    const getColors = () => {
        if (status === 'Completed' || status === 'Active' || status === 'Approved & Dispensed') {
            return 'bg-green-50 text-green-700 border-green-200';
        } else if (status === 'Pending' || status === 'Pending Approval') {
            return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        } else if (status === 'In Progress') {
            return 'bg-blue-50 text-blue-700 border-blue-200';
        } else if (status === 'Emergency' || status === 'Occupied') {
            return 'bg-red-50 text-red-700 border-red-200';
        } else if (status === 'Stable') {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        }
        return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shadow-sm ${getColors()}`}>
            {status}
        </span>
    );
};

// Expandable Section Component
const ExpandableSection = ({ title, icon: Icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 md:px-6 py-2 md:py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
            >
                <div className="flex items-center gap-2 md:gap-3">
                    <Icon className="w-3.5 h-3.5 md:w-5 md:h-5 text-blue-600" />
                    <h3 className="text-[13px] md:text-lg font-bold text-gray-800 uppercase tracking-tight">{title}</h3>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {isOpen && <div className="px-2 md:px-6 py-2 md:py-4 border-t border-gray-50">{children}</div>}
        </div>
    );
};

// Information Grid Component
const InfoGrid = ({ data }) => (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5 md:gap-4">
        {Object.entries(data).map(([key, value]) => (
            <div key={key} className="bg-gray-50/30 p-2 md:p-4 rounded border border-gray-100 flex flex-col justify-center min-h-[44px]">
                <p className="text-[9px] md:text-xs text-gray-500 font-medium uppercase tracking-wider truncate leading-none">{key}</p>
                <p className="text-[11px] md:text-base font-bold text-gray-900 mt-1.5 truncate leading-none line-clamp-1">{value}</p>
            </div>
        ))}
    </div>
);

// Format date for display
const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
};

const PatientOverview = () => {
    const { data, calculateDaysInHospital, refetchPatientData } = useOutletContext();
    const [patientAdmissionData, setPatientAdmissionData] = useState(null);
    const [vitalsData, setVitalsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [vitalsLoading, setVitalsLoading] = useState(true);

    // Fetch patient admission data
    useEffect(() => {
        const fetchPatientAdmissionData = async () => {
            if (!data?.personalInfo?.ipd) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const { data: admissionData, error } = await supabase
                    .from('patient_admission')
                    .select('phone_no, attender_name, attender_mobile_no, reason_for_visit, admission_no, patient_name')
                    .or(`ipd_number.eq.${data.personalInfo.ipd},admission_no.eq.${data.personalInfo.ipd}`)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .single();

                if (error) {
                    console.warn('Error fetching patient admission data:', error);
                    setPatientAdmissionData(null);
                } else {
                    setPatientAdmissionData(admissionData);
                }
            } catch (err) {
                console.error('Error in fetchPatientAdmissionData:', err);
                setPatientAdmissionData(null);
            } finally {
                setLoading(false);
            }
        };

        if (data) {
            fetchPatientAdmissionData();
            fetchLatestVitals();
        }
    }, [data]);

    // Fetch latest vitals data from nurse_assign_task
    const fetchLatestVitals = async () => {
        if (!data?.personalInfo?.ipd) {
            console.log('PatientOverview: No IPD number available');
            setVitalsLoading(false);
            return;
        }

        try {
            setVitalsLoading(true);
            console.log('PatientOverview: Fetching vitals for IPD:', data.personalInfo.ipd);

            const { data: vitalsRecords, error } = await supabase
                .from('nurse_assign_task')
                .select('check_up, actual1, task')
                .eq('Ipd_number', data.personalInfo.ipd)
                .eq('task', 'Vitals Check (BP, Pulse, Temp,SPO2,RR)')
                .not('planned1', 'is', null)
                .not('actual1', 'is', null)
                .not('check_up', 'is', null)
                .order('actual1', { ascending: false })
                .limit(1);

            console.log('PatientOverview: Query result:', { vitalsRecords, error });

            if (error) {
                console.error('PatientOverview: Query error:', error);
                setVitalsData(null);
            } else if (vitalsRecords && vitalsRecords.length > 0) {
                const latestVitals = vitalsRecords[0];
                console.log('PatientOverview: Found vitals:', latestVitals);

                // Parse check_up if it's a string
                let checkUpData = latestVitals.check_up;
                if (typeof checkUpData === 'string') {
                    try {
                        checkUpData = JSON.parse(checkUpData);
                    } catch (e) {
                        console.error('PatientOverview: Error parsing check_up JSON:', e);
                        checkUpData = {};
                    }
                }

                setVitalsData({
                    ...checkUpData,
                    lastUpdated: latestVitals.actual1
                });
            } else {
                console.log('PatientOverview: No vitals found for this patient');
                setVitalsData(null);
            }
        } catch (err) {
            console.error('PatientOverview: Error fetching vitals:', err);
            setVitalsData(null);
        } finally {
            setVitalsLoading(false);
        }
    };

    if (!data) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Loading patient data...</p>
            </div>
        );
    }

    // Get phone number from patient_admission table or fallback
    const getPhoneNumber = () => {
        if (patientAdmissionData?.phone_no) {
            return patientAdmissionData.phone_no;
        }
        return data.personalInfo.phone || 'N/A';
    };

    // Get admission reason from patient_admission table or fallback
    const getAdmissionReason = () => {
        if (patientAdmissionData?.reason_for_visit) {
            return patientAdmissionData.reason_for_visit;
        }
        return data.admissionInfo.reasonForAdmission || 'N/A';
    };

    // Get emergency contact info from patient_admission table
    const getEmergencyContact = () => {
        if (patientAdmissionData?.attender_name && patientAdmissionData?.attender_mobile_no) {
            return `${patientAdmissionData.attender_name} - ${patientAdmissionData.attender_mobile_no}`;
        }
        if (patientAdmissionData?.attender_name) {
            return patientAdmissionData.attender_name;
        }
        if (patientAdmissionData?.attender_mobile_no) {
            return patientAdmissionData.attender_mobile_no;
        }
        return 'N/A';
    };

    return (
        <div className="space-y-2 md:space-y-6">
            {/* Personal Information Section */}
            <ExpandableSection title="Personal Information" icon={User} defaultOpen={true}>
                {loading ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mb-2"></div>
                        <p className="text-gray-600 text-sm">Loading contact information...</p>
                    </div>
                ) : (
                    <InfoGrid
                        data={{
                            'Full Name': data.personalInfo.name || 'N/A',
                            'UHID No.': data.personalInfo.uhid || 'N/A',
                            'IPD No.': data.personalInfo.ipd || 'N/A',
                            'Age': data.personalInfo.age ? `${data.personalInfo.age} years` : 'N/A',
                            'Gender': data.personalInfo.gender || 'N/A',
                            'Consultant Dr.': data.personalInfo.consultantDr || 'N/A',
                            'Phone': getPhoneNumber(),
                            'Address': data.personalInfo.address || 'N/A',
                            'Emergency Contact': getEmergencyContact(),
                        }}
                    />
                )}
                <div className="mt-2 text-[9px] text-gray-400 font-bold italic tracking-tighter">
                    * SOURCE: ADMISSION RECORDS
                </div>
            </ExpandableSection>

            {/* Admission Information Section */}
            <ExpandableSection title="Admission Information" icon={Calendar} defaultOpen={true}>
                {loading ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mb-2"></div>
                        <p className="text-gray-600 text-sm">Loading admission details...</p>
                    </div>
                ) : (
                    <InfoGrid
                        data={{
                            'Admission Date': formatDate(data.admissionInfo.admissionDate),
                            'Admission Type': data.admissionInfo.admissionType || 'N/A',
                            'Mode of Admission': data.admissionInfo.admissionMode || 'N/A',
                            'Reason': getAdmissionReason(),
                            'Status': data.admissionInfo.status || 'N/A',
                            'Duration': `${calculateDaysInHospital(data.admissionInfo.admissionDate)} days`,
                        }}
                    />
                )}
                <div className="mt-2 text-[9px] text-gray-400 font-bold italic tracking-tighter">
                    * SOURCE: ADMISSION RECORDS
                </div>
            </ExpandableSection>

            {/* Department & Ward Information Section */}
            <ExpandableSection title="Department & Ward Information" icon={Bed} defaultOpen={true}>
                <div className="space-y-4">
                    <InfoGrid
                        data={{
                            'Department': data.departmentInfo.department || 'N/A',
                            'Ward': data.departmentInfo.ward || 'N/A',
                            'Bed Number': data.departmentInfo.bedNumber || 'N/A',
                            'Bed Status': data.departmentInfo.bedStatus || 'N/A',
                        }}
                    />
                    <div className="mt-2 text-right">
                        <StatusBadge status={data.departmentInfo.bedStatus} />
                    </div>
                </div>
            </ExpandableSection>

            {/* Doctor Information Section */}
            <ExpandableSection title="Doctor Information" icon={Stethoscope} defaultOpen={true}>
                <div className="space-y-6">
                    <div className="bg-blue-50/30 p-2 md:p-3 rounded border border-blue-100/50">
                        <p className="text-[9px] text-blue-500 font-medium uppercase tracking-wider leading-none">Primary Doctor</p>
                        <p className="text-[13px] md:text-lg font-bold text-gray-900 mt-1.5 leading-none">
                            {data.doctorInfo.primaryDoctor}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">{data.doctorInfo.specialty}</span>
                        </div>
                    </div>

                    <InfoGrid
                        data={{
                            'Specialty': data.doctorInfo.specialty || 'N/A',
                            'Office Hours': data.doctorInfo.officeHours || 'N/A',
                        }}
                    />
                </div>
            </ExpandableSection>

            {/* Current Vitals Monitoring Section */}
            <ExpandableSection title="Current Vitals Monitoring" icon={Activity} defaultOpen={true}>
                {vitalsLoading ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mb-2"></div>
                        <p className="text-gray-600 text-sm">Loading vitals data...</p>
                    </div>
                ) : vitalsData ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[9px] text-gray-400 font-bold italic tracking-tighter">
                                UPDATED: {formatDate(vitalsData.lastUpdated)}
                            </p>
                            <StatusBadge status="Recorded" />
                        </div>
                        <InfoGrid
                            data={{
                                'Blood Pressure': vitalsData.bloodPressure || 'N/A',
                                'Pulse Rate': vitalsData.pulseRate ? `${vitalsData.pulseRate} bpm` : 'N/A',
                                'Temperature': vitalsData.temperature ? `${vitalsData.temperature}°F` : 'N/A',
                                'SPO2': vitalsData.spo2 ? `${vitalsData.spo2}%` : 'N/A',
                                'Respiratory Rate': vitalsData.rr ? `${vitalsData.rr} breaths/min` : 'N/A',
                            }}
                        />
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-1">No vitals data recorded yet</p>
                        <p className="text-xs text-gray-400">Vitals will appear here once recorded by nursing staff</p>
                    </div>
                )}
            </ExpandableSection>

            {/* Billing Information Section
            {data.billing && (
                <ExpandableSection title="Billing Information" icon={Calendar} defaultOpen={false}>
                    <InfoGrid
                        data={{
                            'Total Billed Amount': data.billing.totalBilledAmount 
                                ? `₹${data.billing.totalBilledAmount.toLocaleString('en-IN')}` 
                                : 'N/A',
                            'Outstanding Amount': data.billing.outstandingAmount 
                                ? `₹${data.billing.outstandingAmount.toLocaleString('en-IN')}` 
                                : 'N/A',
                            'Payment Mode': data.billing.paymentMode || 'N/A',
                            'Insurance Company': data.billing.insuranceCompany || 'N/A',
                        }}
                    />
                </ExpandableSection>
            )}

            {/* Treatment Plan Section */}
            {/* <ExpandableSection title="Treatment Plan" icon={Activity} defaultOpen={false}>
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 font-medium">Diagnosis</p>
                        <p className="text-base font-semibold text-gray-900 mt-1">
                            {data.treatmentPlan.diagnosis}
                        </p>
                    </div>

                    {data.treatmentPlan.procedures && data.treatmentPlan.procedures.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600 font-medium mb-2">Procedures</p>
                            <div className="space-y-3">
                                {data.treatmentPlan.procedures.map((procedure, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                                        <div>
                                            <p className="font-medium text-gray-900">{procedure.name}</p>
                                            <p className="text-sm text-gray-600">{procedure.notes}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600">{procedure.date}</p>
                                            <StatusBadge status={procedure.status} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </ExpandableSection>  */}

            {/* Additional Patient Admission Details Section */}
            {/* {patientAdmissionData && (
                <ExpandableSection title="Admission Details" icon={Calendar} defaultOpen={false}>
                    <div className="space-y-4">
                        <InfoGrid
                            data={{
                                'Admission Number': patientAdmissionData.admission_no || 'N/A',
                                'Patient Name (Admission)': patientAdmissionData.patient_name || 'N/A',
                                'Phone Number': patientAdmissionData.phone_no || 'N/A',
                                'Attender Name': patientAdmissionData.attender_name || 'N/A',
                                'Attender Mobile': patientAdmissionData.attender_mobile_no || 'N/A',
                                'Reason for Visit': patientAdmissionData.reason_for_visit || 'N/A',
                            }}
                        />
                        <div className="text-xs text-gray-500 mt-2">
                            <p>This data is fetched from the patient admission table</p>
                        </div>
                    </div>
                </ExpandableSection>
            )} */}

            {/* Refresh Button */}
            <div className="flex justify-end">
                <button
                    onClick={refetchPatientData}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Patient Data
                </button>
            </div>
        </div>
    );
};

export default PatientOverview;