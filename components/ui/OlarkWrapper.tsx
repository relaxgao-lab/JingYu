'use client'
import { isMobile } from '@/libs/utils'
import OlarkChat from './OlarkChat2'  
import { useEffect, useState } from 'react'

export function OlarkWrapper() {


  const [isMob,setIsMob] = useState(true)
  useEffect(()=>{
    setIsMob(isMobile())
  },[])
  return (
    <>
      <OlarkChat/>
    </>
  )
}
