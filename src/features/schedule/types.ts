export type LessonSlot = {
  id: string;
  group_id: string;
  room_id: string | null;
  teacher_user_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type NewLessonInput = Omit<LessonSlot, "id"> & {
  subject_id: string | null;
  notes: string | null;
};

export type ScheduleConflict = {
  kind: "group" | "teacher" | "room";
  lessonId: string;
};

export type ScheduleLesson = LessonSlot & {
  subject_id: string | null;
  notes: string | null;
  group: { name: string } | null;
  subject: { name: string } | null;
  room: { name: string } | null;
};

export type ScheduleGroup = {
  id: string;
  name: string;
  teacher_id: string | null;
  subject_id: string | null;
};

export type ScheduleRef = {
  id: string;
  name: string;
};

export type ScheduleTeacher = {
  user_id: string;
  name: string;
};
