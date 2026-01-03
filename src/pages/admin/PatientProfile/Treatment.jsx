import React from 'react';
import { ArrowLeft, Stethoscope } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

const StatusBadge = ({ status }) => {
  const getColors = () => {
    if (status === 'Completed') return 'bg-green-100 text-green-700 border-green-300';
    if (status === 'Pending') return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    if (status === 'In Progress') return 'bg-blue-100 text-blue-700 border-blue-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getColors()}`}>
      {status}
    </span>
  );
};

export default function Treatment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const data = location.state?.data;

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No patient data available</p>
          <button
            onClick={() => navigate(`/admin/patient-profile/${id}`)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Back to Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => navigate(`/admin/patient-profile/${id}`)}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Patient Overview
          </button>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
          <div className="flex items-center gap-3">
            <Stethoscope className="w-8 h-8" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Treatment Plan</h1>
              <p className="text-sm opacity-90 mt-1">{data.personalInfo.name} - {data.personalInfo.uhid}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Diagnosis Section */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Diagnosis</h3>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-gray-700">{data.treatmentPlan?.diagnosis || 'To be diagnosed by doctor'}</p>
            </div>
          </div>

          {/* Scheduled Procedures */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduled Procedures</h3>
            <div className="space-y-3">
              {data.treatmentPlan?.procedures?.map((proc, idx) => (
                <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{proc.name}</p>
                      <p className="text-sm text-gray-600 mt-1">Date: {proc.date}</p>
                      <p className="text-sm text-gray-600">Notes: {proc.notes}</p>
                    </div>
                    <StatusBadge status={proc.status} />
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-4">No procedures scheduled</p>
              )}
            </div>
          </div>

          {/* Current Medications */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Medications</h3>
            <div className="space-y-3">
              {data.treatmentPlan?.medications?.length > 0 ? (
                data.treatmentPlan.medications.map((med, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-gray-900">{med.name}</p>
                      <StatusBadge status={med.status} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600 mt-2">
                      <div><span className="font-medium">Dose:</span> {med.dose}</div>
                      <div><span className="font-medium">Frequency:</span> {med.frequency}</div>
                      <div><span className="font-medium">Start Date:</span> {med.startDate}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No medications prescribed</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
