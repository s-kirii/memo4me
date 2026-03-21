export type NoteListItem = {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type NoteDetail = {
  id: string;
  title: string;
  contentMd: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type TagItem = {
  id: string;
  name: string;
};

export type NoteInput = {
  title: string;
  contentMd: string;
  tags: string[];
};

export type ListNotesParams = {
  q?: string;
  tag?: string;
  sort?: string;
};
