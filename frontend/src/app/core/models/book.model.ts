export interface Author {
  _id: string;
  name: string;
  bio?: string;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
}

export interface Book {
  _id: string;
  title: string;
  author: Author;
  category: Category;
  description: string;
  publishedYear?: number;
  rating: number;
  isAvailable: boolean;
  filePath: string;
  coverImage: string;
  viewsCount: number;
  downloads: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookResponse {
  message: string;
  book: Book;
}
