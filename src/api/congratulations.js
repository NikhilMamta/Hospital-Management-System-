import supabase from '../SupabaseClient';

/**
 * Fetches all congratulations posts ordered by creation date (newest first).
 */
export const getCongratulationsPosts = async () => {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);
  const isoDate = yesterday.toISOString();

  const { data, error } = await supabase
    .from('congratulations_posts')
    .select('*')
    .eq('is_active', true)
    .gte('created_at', isoDate)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Creates a new congratulations post.
 * Deactivates all previous posts to ensure only one is active.
 */
export const createCongratulationsPost = async (post) => {
  // 1. Deactivate all previous posts
  await supabase
    .from('congratulations_posts')
    .update({ is_active: false })
    .neq('is_active', false);

  // 2. Insert new post as active
  const { data, error } = await supabase
    .from('congratulations_posts')
    .insert([{ ...post, is_active: true }])
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
    .from('hospital-assets') // Adjust bucket name if needed
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('hospital-assets')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

/**
 * Fetches all staff members with designation 'Staff Nurse' for the selection dropdown.
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
