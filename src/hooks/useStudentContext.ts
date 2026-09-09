import { useAuth } from '../features/auth/AuthContext';
import { useSupabaseQuery } from './useSupabaseQuery';
import { getStudentContext } from '../services/studentService';

export function useStudentContext(){const {user,profile}=useAuth();const query=useSupabaseQuery(()=>getStudentContext(user?.id??''),[user?.id]);return {...query,profile}}
