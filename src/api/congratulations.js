import supabase from '../SupabaseClient';

/**
 * Fetches active congratulations posts within the last 24 hours.
 * Optionally filtered by post_type ('nurse' | 'rmo').
 */
export const getCongratulationsPosts = async (postType = null) => {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);
  const isoDate = yesterday.toISOString();

  let query = supabase
    .from('congratulations_posts')
    .select('*')
    .eq('is_active', true)
    .gte('created_at', isoDate)
    .order('created_at', { ascending: false });

  if (postType && typeof postType === 'string') {
    query = query.eq('post_type', postType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Creates a new congratulations post.
 * Deactivates all previous posts of the SAME type to allow one active per type.
 */
export const createCongratulationsPost = async (post) => {
  const postType = post.post_type || 'nurse';

  // 1. Deactivate all previous posts of the same type
  await supabase
    .from('congratulations_posts')
    .update({ is_active: false })
    .eq('post_type', postType)
    .eq('is_active', true);

  // 2. Insert new post as active
  const { data, error } = await supabase
    .from('congratulations_posts')
    .insert([{ ...post, post_type: postType, is_active: true }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Uploads a photo to Supabase storage.
 * @param {File} file - The image file to upload.
 */
export const uploadNursePhoto = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `nurse-congratulations/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('hospital-assets')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('hospital-assets')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

/**
 * Fetches all staff members with nurse-related designations.
 */
export const getNursesForSelection = async () => {
  const { data, error } = await supabase
    .from('all_staff')
    .select('name, designation')
    .ilike('designation', '%Nurse%')
    .order('name');

  if (error) throw error;
  return data || [];
};

/**
 * Fetches all staff members with RMO-related designations.
 */
export const getRMOsForSelection = async () => {
  const { data, error } = await supabase
    .from('all_staff')
    .select('name, designation')
    .or('designation.ilike.%RMO%,designation.ilike.%Resident Medical Officer%,designation.ilike.%Medical Officer%')
    .order('name');

  if (error) throw error;
  return data || [];
};

/**
 * Deactivates a congratulations post (Soft Delete).
 */
export const deleteCongratulationsPost = async (id) => {
  const { error } = await supabase
    .from('congratulations_posts')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
  return true;
};
