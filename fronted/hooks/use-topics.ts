"use client"

import { useEffect, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

export interface CourseTopic {
  id: string          // Topic.topicId (the stable slug)
  name: string
  icon: string
  description: string
  difficulty: string
  xpReward: number
}

// Fetches the live module list from the backend (GET /api/topics is public,
// no auth needed) — replaces what used to be 4 independent hardcoded TOPICS
// consts scattered across the student/admin pages, so the teacher's CRUD
// (create/rename/delete a module) is actually reflected everywhere at once.
export function useTopics() {
  const [topics, setTopics] = useState<CourseTopic[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    fetch(`${API}/topics`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTopics(
            (d.data as any[]).map(t => ({
              id: t.topicId,
              name: t.name,
              icon: t.icon,
              description: t.description,
              difficulty: t.difficulty,
              xpReward: t.xpReward,
            }))
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  return { topics, loading, refresh }
}
