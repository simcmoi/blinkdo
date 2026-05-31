'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, ChevronDown } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DateTimePickerProps = {
  date: Date | undefined
  onDateTimeChange: (date: Date) => void
  onClose?: () => void
}

// Génère toutes les heures de la journée par tranches de 30 minutes
function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0')
      const m = minute.toString().padStart(2, '0')
      slots.push(`${h}:${m}`)
    }
  }
  return slots
}

export function DateTimePicker({ date, onDateTimeChange, onClose }: DateTimePickerProps) {
  const { t } = useTranslation()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(date)
  const [timeValue, setTimeValue] = useState(() => {
    if (date) {
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return '09:00'
  })
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const timeSlots = generateTimeSlots()

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTimeDropdownOpen(false)
      }
    }

    if (isTimeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isTimeDropdownOpen])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) return
    setSelectedDate(newDate)
  }

  const handleTimeChange = (newTime: string) => {
    setTimeValue(newTime)
    setIsTimeDropdownOpen(false)
  }

  const handleConfirm = () => {
    if (!selectedDate) return
    
    const [hours, minutes] = timeValue.split(':').map(Number)
    const dateTime = new Date(selectedDate)
    dateTime.setHours(hours, minutes, 0, 0)
    
    onDateTimeChange(dateTime)
    onClose?.()
  }

  const handleCancel = () => {
    onClose?.()
  }

  return (
    <div className="flex flex-col bg-popover">
      {/* Calendrier */}
      <div className="p-3 bg-popover">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          autoFocus
          className="p-0"
        />
      </div>

      {/* Sélecteur d'heure */}
      <div className="border-t px-3 py-3 space-y-2 bg-popover">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium">Définir l'heure</Label>
        </div>
        
        {/* Dropdown custom */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsTimeDropdownOpen(!isTimeDropdownOpen)
            }}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span>{timeValue}</span>
            <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isTimeDropdownOpen && "rotate-180")} />
          </button>
          
          {isTimeDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
              <div className="max-h-[200px] overflow-y-auto p-1">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleTimeChange(time)
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
                      timeValue === time && "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Boutons Annuler / Terminé */}
      <div className="border-t px-3 py-2 flex gap-2 bg-popover">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="flex-1"
          onClick={handleCancel}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleConfirm}
          disabled={!selectedDate}
        >
          {t('common.done')}
        </Button>
      </div>
    </div>
  )
}
