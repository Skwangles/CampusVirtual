// src/SearchBar.tsx
import React, { useState, ChangeEvent, MouseEvent } from 'react'
import './SearchBar.css'
import { toast } from 'react-toastify'
// Define the type for the props
interface SearchBarProps {
  data: string[]
  jumpToCallback: (selected: string) => void
  highlightCallback: (selected: string) => void
}

const IncludesValue = (data: string[], value: string) => {
  return data.map((val) => val.toLowerCase()).includes(value.toLowerCase())
}

const SearchBar: React.FC<SearchBarProps> = ({
  data,
  jumpToCallback,
  highlightCallback,
}) => {
  const [query, setQuery] = useState<string>('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isDisabled, setIsDisabled] = useState<boolean>(true)

  // Handle input changes
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setQuery(value)
    setIsDisabled(!IncludesValue(data, value))
    if (value) {
      const filteredSuggestions = data.filter((item) =>
        item.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestions(filteredSuggestions.sort())
    } else {
      setSuggestions([])
    }
  }

  // Handle suggestion clicks
  const handleSuggestionClick =
    (suggestion: string) => (event: MouseEvent<HTMLLIElement>) => {
      setQuery(suggestion)
      setIsDisabled(false)
      setSuggestions([])
    }

  return (
    <div
      className="search-bar"
      onMouseEnter={() =>
        suggestions.length === 0 && query.length === 0
          ? setSuggestions(data.sort())
          : null
      }
      onMouseLeave={() => (query.length == 0 ? setSuggestions([]) : null)}
    >
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Search a location..."
      />
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((suggestion, index) => (
            <li key={index} onClick={handleSuggestionClick(suggestion)}>
              {suggestion}
            </li>
          ))}
        </ul>
      )}
      <button
        className="go-button"
        onClick={() => {
          if (IncludesValue(data, query)) highlightCallback(query)
          else toast.error('Please enter/select a valid location')
        }}
        disabled={isDisabled}
      >
        Highlight Path
      </button>
      <button
        className="go-button"
        onClick={() => {
          if (IncludesValue(data, query)) jumpToCallback(query)
          else toast.error('Please enter/select a valid location')
        }}
        disabled={isDisabled}
      >
        Go To
      </button>
    </div>
  )
}

export default SearchBar
