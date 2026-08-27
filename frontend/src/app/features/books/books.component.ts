import { Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface Book {
  id: number;
  title: string;
  author: string;
  category: string;
  year: number;
  description: string;
  rating: number;
  views: number;
  cover: string;
}

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss'
})
export class BooksComponent {

  search = '';
  selectedCategory = 'الكل';
  sort = 'newest';

  categories = [
    'الكل',
    'روايات',
    'تاريخ',
    'فلسفة',
    'علوم',
    'أدب',
    'تطوير الذات'
  ];

  books: Book[] = [
    {
      id: 1,
      title: 'الأمير',
      author: 'نيكولو مكيافيلي',
      category: 'فلسفة',
      year: 1532,
      description: 'من أشهر الكتب الكلاسيكية في الفكر السياسي وفهم السلطة.',
      rating: 4.8,
      views: 12450,
      cover: 'assets/images/default-book-cover.svg'
    },
    {
      id: 2,
      title: 'هكذا تكلم زرادشت',
      author: 'فريدريك نيتشه',
      category: 'فلسفة',
      year: 1883,
      description: 'عمل فلسفي أدبي يستكشف الإنسان والقيم والإرادة.',
      rating: 4.7,
      views: 9870,
      cover: 'assets/images/default-book-cover.svg'
    },
    {
      id: 3,
      title: 'فن الحرب',
      author: 'سون تزو',
      category: 'تاريخ',
      year: -500,
      description: 'كتاب كلاسيكي عن الاستراتيجية والتخطيط والقيادة.',
      rating: 4.9,
      views: 18320,
      cover: 'assets/images/default-book-cover.svg'
    },
    {
      id: 4,
      title: 'الجريمة والعقاب',
      author: 'فيودور دوستويفسكي',
      category: 'روايات',
      year: 1866,
      description: 'رواية عميقة تتناول الجريمة والذنب والصراع النفسي.',
      rating: 4.9,
      views: 22100,
      cover: 'assets/images/default-book-cover.svg'
    },
    {
      id: 5,
      title: 'مئة عام من العزلة',
      author: 'غابرييل غارسيا ماركيز',
      category: 'أدب',
      year: 1967,
      description: 'واحدة من أشهر الروايات في الأدب العالمي الحديث.',
      rating: 4.8,
      views: 15640,
      cover: 'assets/images/default-book-cover.svg'
    },
    {
      id: 6,
      title: 'العادات الذرية',
      author: 'جيمس كلير',
      category: 'تطوير الذات',
      year: 2018,
      description: 'منهج عملي لبناء العادات الصغيرة وتحقيق نتائج كبيرة.',
      rating: 4.6,
      views: 19450,
      cover: 'assets/images/default-book-cover.svg'
    }
  ];

  get filteredBooks(): Book[] {
    let result = this.books.filter(book => {
      const term = this.search.trim().toLowerCase();

      const matchesSearch =
        !term ||
        book.title.toLowerCase().includes(term) ||
        book.author.toLowerCase().includes(term);

      const matchesCategory =
        this.selectedCategory === 'الكل' ||
        book.category === this.selectedCategory;

      return matchesSearch && matchesCategory;
    });

    if (this.sort === 'rating') {
      result = [...result].sort((a, b) => b.rating - a.rating);
    }

    if (this.sort === 'views') {
      result = [...result].sort((a, b) => b.views - a.views);
    }

    if (this.sort === 'newest') {
      result = [...result].sort((a, b) => b.year - a.year);
    }

    return result;
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
  }

  clearSearch() {
    this.search = '';
    this.selectedCategory = 'الكل';
  }
}
