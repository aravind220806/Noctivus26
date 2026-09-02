import React from 'react';

export function CoordinatorSectionNav({ activeCategory, onSelectCategory }) {
  const categories = [
    { id: 'faculty', label: 'FACULTY', target: '#faculty' },
    { id: 'student', label: 'STUDENTS', target: '#student' },
    { id: 'registration', label: 'REGISTRATION', target: '#registration' },
  ];

  const handleCategoryClick = (e, cat) => {
    e.preventDefault();
    if (onSelectCategory) {
      onSelectCategory(cat.id);
    }
    const el = document.getElementById(cat.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="noc-cat-nav-wrapper" aria-label="Coordinator Categories">
      <div className="noc-cat-nav-strip">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;

          return (
            <a
              key={cat.id}
              href={cat.target}
              className={`noc-cat-btn ${isActive ? 'is-active' : ''}`}
              onClick={(e) => handleCategoryClick(e, cat)}
            >
              <span className="noc-cat-bracket">[</span>
              <span className="noc-cat-label">{cat.label}</span>
              <span className="noc-cat-bracket">]</span>
              {isActive && <span className="noc-cat-active-dot" aria-hidden="true" />}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
