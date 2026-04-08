import supabase from '../SupabaseClient';

/**
 * NURSE TASKS API (nurse_assign_task table)
 * Centralized service for managing nursing assessments, vitals monitoring, and daily tasks.
 */

/**
 * Fetches all nurse tasks with optional filtering.
 * Often used by the Nurse Task List and Score Dashboards.
 */
export const getNurseTasks = async ({ 
  nurseName = null, 
  status = null, 
  shift = null, 
  dateRange = null 
} = {}) => {
  let query = supabase
    .from('nurse_assign_task')
    .select('*')
    .order('planned1', { ascending: false });

  if (nurseName) {
    query = query.ilike('assign_nurse', `%${nurseName}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (shift) {
    query = query.eq('shift', shift);
  }
  if (dateRange?.start && dateRange?.end) {
    query = query.gte('planned1', dateRange.start).lte('planned1', dateRange.end);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Fetches tasks for a specific patient.
 * Used in Patient Profile -> Nursing tab.
 */
export const getPatientNurseTasks = async (ipdNumber) => {
  if (!ipdNumber) return [];

  const { data, error } = await supabase
    .from('nurse_assign_task')
    .select('*')
    .eq('Ipd_number', ipdNumber) // NOTE: Capital 'I' in database
    .order('planned1', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Saves or updates a nurse task.
 */
export const saveNurseTask = async (taskData) => {
  const isUpdating = !!taskData.id;
  
  if (isUpdating) {
    const { data, error } = await supabase
      .from('nurse_assign_task')
      .update(taskData)
      .eq('id', taskData.id)
      .select();
    
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await supabase
      .from('nurse_assign_task')
      .insert([taskData])
      .select();
    
    if (error) throw error;
    return data[0];
  }
};

/**
 * Updates only the status and completion time of a task.
 * Used for quick "Mark as Complete" actions.
 */
export const updateNurseTaskStatus = async (taskId, status, actualTime, submittedBy) => {
  const { data, error } = await supabase
    .from('nurse_assign_task')
    .update({ 
      status, 
      actual1: actualTime,
      submitted_by: submittedBy 
    })
    .eq('id', taskId)
    .select();

  if (error) throw error;
  return data[0];
};

/**
 * Deletes a nurse task.
 */
export const deleteNurseTask = async (taskId) => {
  const { error } = await supabase
    .from('nurse_assign_task')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
  return true;
};

/**
 * Fetches latest vitals monitored by nurses for a specific patient.
 * (Transforms the generic task data into meaningful patient vitals)
 */
export const getLatestVitals = async (ipdNumber) => {
  if (!ipdNumber) return null;

  const { data, error } = await supabase
    .from('nurse_assign_task')
    .select('*')
    .eq('Ipd_number', ipdNumber)
    .eq('status', 'Completed')
    .not('check_up', 'is', null)
    .order('actual1', { ascending: false })
    .limit(10); // Check last 10 completed tasks for vitals

  if (error) throw error;
  return data || [];
};
