export type SiteTeacher = {
  id: string;
  name: string;
  subject: string;
  qualification?: string;
  experience?: string;
  students?: string;
  photo_url?: string;
};
export type SiteTeachers = { items: SiteTeacher[] };
