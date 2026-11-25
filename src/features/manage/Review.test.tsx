import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { School, Student } from '../../domain/types'
import { useReviewQueue } from '../../data/review'
import { useStudents } from '../../data/students'
import { useSchools } from '../../data/scope'
import { mergeStudents } from '../../data/functions'
import { Review } from './Review'

vi.mock('../../data/review',() => ({useReviewQueue:vi.fn(),reviewReason:() => 'Posible duplicado',resolveReview:vi.fn()}))
vi.mock('../../data/students',() => ({useStudents:vi.fn()}))
vi.mock('../../data/scope',() => ({useSchools:vi.fn()}))
vi.mock('../../data/functions',() => ({mergeStudents:vi.fn()}))
afterEach(cleanup)

it('compara las sedes y grados, previsualiza el nombre limpio e indica el progreso de la unión',async () => {
  Object.defineProperties(HTMLDialogElement.prototype,{
    showModal:{configurable:true,value:function(this:HTMLDialogElement){this.open=true}},
    close:{configurable:true,value:function(this:HTMLDialogElement){this.open=false}}
  })
  const row={id:'s_new',fullName:'ANA MARIA   perez',campus:'a',code:'N',grade:3,schoolId:'s',active:true,reviewReasons:['posible_duplicado:s_old']} as Student
  const target={...row,id:'s_old',code:'O',campus:'b',grade:5,fullName:'Ana María Pérez'}
  const school={id:'s',campuses:[{id:'a',name:'Sede Norte'},{id:'b',name:'Sede Sur'}]} as School
  const ready={loading:false,error:undefined}
  vi.mocked(useSchools).mockReturnValue({...ready,schools:[school]})
  vi.mocked(useStudents).mockReturnValue({...ready,students:[row,target]})
  vi.mocked(useReviewQueue).mockReturnValue({...ready,data:[row]})
  let finish!: () => void
  vi.mocked(mergeStudents).mockImplementation(() => new Promise(resolve => {
    finish=() => resolve({moved:{attendance:1,evaluations:2,groups:1}})
  }))
  render(<Review/>)
  expect(screen.queryByText('Posible duplicado')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:/Información sobre/}))
  expect(screen.getByText(/se guardará como Ana Maria Perez/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Cerrar'}))
  expect(screen.getByText('Posible coincidencia')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Comparar fichas'}))
  const dialog=within(screen.getByRole('dialog'))
  expect(dialog.getByText('Sede Norte')).toBeTruthy()
  expect(dialog.getByText('Sede Sur')).toBeTruthy()
  expect(dialog.getByText(/Los grados son diferentes/)).toBeTruthy()
  fireEvent.click(dialog.getByRole('button',{name:'Confirmar unión'}))
  expect(dialog.getByText('Uniendo fichas…')).toBeTruthy()
  expect(mergeStudents).toHaveBeenCalledWith('s_new','s_old')
  finish()
  expect(await screen.findByText('Fichas unidas.')).toBeTruthy()
})
