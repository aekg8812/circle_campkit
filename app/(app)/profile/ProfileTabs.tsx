'use client'

import { useState } from 'react'
import ProfileForm from './ProfileForm'
import CarsClient from './cars/CarsClient'
import GearClient from './gear/GearClient'

type Profile = {
  id: string
  name: string
  grade: number | null
  department: string | null
  student_id: string | null
  school_email: string | null
  phone: string | null
  academic_advisor: string | null
  avatar_url: string | null
}

type Car = {
  id: string
  name: string | null
  capacity: number | null
  luggage_capacity: string | null
}

type Gear = {
  id: string
  name: string
  category: string | null
  price: number | null
  quantity: number | null
  capacity: number | null
  photo_url: string | null
}

type Tab = 'profile' | 'cars' | 'gear'

type Props = {
  profile: Profile | null
  cars: Car[]
  gear: Gear[]
  userId: string
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'プロフィール' },
  { id: 'cars', label: '車' },
  { id: 'gear', label: '道具' },
]

export default function ProfileTabs({ profile, cars, gear, userId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-1 shadow-sm">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'profile' && <ProfileForm profile={profile} userId={userId} />}
      {activeTab === 'cars' && <CarsClient initialCars={cars} userId={userId} />}
      {activeTab === 'gear' && <GearClient initialGear={gear} userId={userId} />}
    </div>
  )
}
