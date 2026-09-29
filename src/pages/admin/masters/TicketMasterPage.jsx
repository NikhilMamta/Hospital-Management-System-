import React from "react";
import { LifeBuoy } from "lucide-react";
import TicketMasterSettings from "../../../components/staffTickets/TicketMasterSettings";

/**
 * TicketMasterPage
 * Staff Ticket Masters (Categories, Issues, Departments, Assignees) master management view under Settings.
 */
const TicketMasterPage = () => {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
          <LifeBuoy className="w-6 h-6 mr-2 text-blue-600" />
          Staff Ticket Masters
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Categories, SLA Days, Issue Options, Departments, and Category Assignees configuration
        </p>
      </div>

      <TicketMasterSettings />
    </div>
  );
};

export default TicketMasterPage;
