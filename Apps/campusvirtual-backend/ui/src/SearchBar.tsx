// src/SearchBar.tsx
import React, { useState, ChangeEvent, MouseEvent } from 'react'
import './SearchBar.css'
import { toast } from 'react-toastify'
import { ArrowUpRight, Eye } from 'react-feather'
// Define the type for the props
interface SearchBarProps {
  data: string[]
  jumpToCallback: (selected: string) => void
  highlightCallback: (selected: string) => void
}

const IncludesValue = (data: string[], value: string) => {
  return data.find((val) => val.toLowerCase() == value.toLowerCase())
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
        item
          .toLowerCase()
          .replace(/[.'-\s]/, '')
          .includes(value.replace(/[.'-\s]/, '').toLowerCase())
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
      className="search-bar flex flex-row flex-wrap"
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
        onKeyDown={(event) => {
          if (event.key == 'Enter') {
            if (IncludesValue(data, query)) {
              setIsDisabled(false)
              setSuggestions([])
              document.getElementById('highlight-button')?.click()
            } else if (suggestions.length > 0) {
              setQuery(suggestions[0])
              setIsDisabled(false)
              setSuggestions([])
              document.getElementById('highlight-button')?.click()
            }
          }
        }}
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
        id="highlight-button"
        className="go-button flex flex-row items-center"
        onClick={() => {
          const searchFor = IncludesValue(data, query)
          if (searchFor) highlightCallback(searchFor)
          else toast.error('Please enter/select a valid location')
        }}
        disabled={isDisabled}
      >
        <Eye className="mr-2" />
        Guide Me
      </button>
      <button
        id="goTo-button"
        className="go-button flex flex-row items-center"
        onClick={() => {
          const searchFor = IncludesValue(data, query)
          if (searchFor) jumpToCallback(searchFor)
          else toast.error('Please enter/select a valid location')
        }}
        disabled={isDisabled}
      >
        <ArrowUpRight className="mr-2" />
        Go To
      </button>
    </div>
  )
}

export default SearchBar
