// src/components/CategoryDropdown.jsx
export default function CategoryDropdown({ categories, selectedCategory, onSelectCategory }) {
  return (
    <select
      className="category-dropdown"
      value={selectedCategory}
      onChange={(e) => onSelectCategory(e.target.value)}
    >
      {categories.map((cat) => (
        <option key={cat} value={cat}>{cat}</option>
      ))}
    </select>
  );
}