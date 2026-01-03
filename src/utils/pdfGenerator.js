import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { employees, departments, getTopScorers, getLowestScorers, getEmployeesByPendingTasks } from '../data/mockData';

export const generateDashboardPDF = () => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString();

  // Add title
  doc.setFontSize(20);
  doc.text('MIS System - Dashboard Report', 105, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Generated on: ${today}`, 105, 22, { align: 'center' });
  
  // Add horizontal line
  doc.setLineWidth(0.5);
  doc.line(14, 25, 196, 25);
  
  // All employees table
  doc.setFontSize(14);
  doc.text('List of Employees', 14, 35);
  
  const employeeData = employees.map((emp) => [
    emp.id,
    emp.name,
    emp.department,
    emp.score,
    `${emp.completedTasks}/${emp.totalTasks}`,
    emp.pendingTasks
  ]);
  
  doc.autoTable({
    startY: 40,
    head: [['ID', 'Name', 'Department', 'Score', 'Completed/Total Tasks', 'Pending Tasks']],
    body: employeeData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] }
  });
  
  // Top 5 Scorers
  const topScorers = getTopScorers(5);
  const topScorersY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.text('Top 5 Scorers', 14, topScorersY);
  
  const topScorersData = topScorers.map((emp) => [
    emp.name,
    emp.department,
    emp.score
  ]);
  
  doc.autoTable({
    startY: topScorersY + 5,
    head: [['Name', 'Department', 'Score']],
    body: topScorersData,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129] }
  });
  
  // Employees with most pending tasks
  const pendingEmployees = getEmployeesByPendingTasks().slice(0, 5);
  const pendingY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.text('Top 5 Employees with Pending Tasks', 14, pendingY);
  
  const pendingData = pendingEmployees.map((emp) => [
    emp.name,
    emp.department,
    emp.pendingTasks,
    emp.totalTasks
  ]);
  
  doc.autoTable({
    startY: pendingY + 5,
    head: [['Name', 'Department', 'Pending Tasks', 'Total Tasks']],
    body: pendingData,
    theme: 'striped',
    headStyles: { fillColor: [239, 68, 68] }
  });
  
  // Add new page for department scores
  doc.addPage();
  
  // Department scores
  doc.setFontSize(14);
  doc.text('Department Scores', 14, 15);
  
  const departmentData = departments.map((dept) => [
    dept.name,
    dept.employeeCount,
    dept.averageScore.toFixed(1)
  ]);
  
  doc.autoTable({
    startY: 20,
    head: [['Department', 'Number of Employees', 'Average Score']],
    body: departmentData,
    theme: 'striped',
    headStyles: { fillColor: [124, 58, 237] }
  });
  
  // Lowest scorers
  const lowestScorers = getLowestScorers(5);
  const lowestY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.text('5 Lowest Scoring Employees', 14, lowestY);
  
  const lowestData = lowestScorers.map((emp) => [
    emp.name,
    emp.department,
    emp.score
  ]);
  
  doc.autoTable({
    startY: lowestY + 5,
    head: [['Name', 'Department', 'Score']],
    body: lowestData,
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11] }
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount} - Powered by Botivate (www.botivate.in)`, 105, 287, { align: 'center' });
  }
  
  // Save the PDF
  doc.save('MIS-Dashboard-Report.pdf');
};