import type {GraphNode} from '@threadpeak/contracts/learning-v2'
import {mergeNodeEdits,nodeFieldPatch} from '@threadpeak/contracts/node-edits'
export type EditEntry={baseNodes:GraphNode[];nodes:GraphNode[]}
/** Field edits retain only changed cards; structural edits retain their ordering. */
export const editEntry=(before:GraphNode[],after:GraphNode[]):EditEntry=>nodeFieldPatch(before,after)??{baseNodes:before,nodes:after}
/** Undo/redo is a three-way edit, so intervening server cards cannot disappear. */
export const applyEditEntry=(entry:EditEntry,current:GraphNode[],undo=false)=>mergeNodeEdits(undo?entry.nodes:entry.baseNodes,undo?entry.baseNodes:entry.nodes,current)
