import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataList } from './DataList'
import type { DataListColumn } from './DataList.types'

interface Row {
  id: string
  name: string
  status: string
  updatedAt: string
}

const columns: DataListColumn<Row>[] = [
  {
    id: 'name',
    label: 'Name',
    defaultWidth: 220,
    minWidth: 180,
    priority: 1,
    locked: true,
    render: (row) => row.name,
  },
  {
    id: 'status',
    label: 'Status',
    defaultWidth: 160,
    minWidth: 120,
    priority: 2,
    render: (row) => row.status,
  },
  {
    id: 'updated',
    label: 'Updated',
    defaultWidth: 180,
    minWidth: 140,
    priority: 4,
    defaultHidden: true,
    render: (row) => row.updatedAt,
  },
]

const rows: Row[] = [
  {
    id: 'row-1',
    name: 'Example record',
    status: 'Active',
    updatedAt: '21 Sep 2026',
  },
]

describe('DataList column visibility', () => {
  beforeEach(() => {
    window.localStorage.removeItem('test.data-list.horizontal-scroll')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 420,
      top: 0,
      width: 420,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders every checked column and widens the scroll surface', async () => {
    const user = userEvent.setup()

    render(
      <DataList
        columns={columns}
        getRowId={(row) => row.id}
        pagination={{
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
        rowActions={() => <button type="button">Open</button>}
        rows={rows}
        search=""
        searchPlaceholder="Search records"
        selection={{ selectedIds: [], onSelectionChange: vi.fn() }}
        storageKey="test.data-list.horizontal-scroll"
        onSearchChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    await user.click(screen.getByRole('checkbox', { name: 'Updated' }))

    const tableRegion = screen.getByRole('region', { name: 'records table' })
    await waitFor(() => {
      expect(tableRegion.firstElementChild).toHaveStyle({ minWidth: '748px' })
    })

    expect(within(tableRegion).getByText('Updated')).toBeInTheDocument()
    expect(within(tableRegion).getByText('21 Sep 2026')).toBeInTheDocument()
    expect(screen.queryByText('no room')).not.toBeInTheDocument()
  })

  it('keeps selection controls inside flat sticky table cells', () => {
    render(
      <DataList
        columns={columns}
        getRowId={(row) => row.id}
        pagination={{
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
        rows={rows}
        search=""
        searchPlaceholder="Search records"
        selection={{ selectedIds: [], onSelectionChange: vi.fn() }}
        storageKey="test.data-list.horizontal-scroll"
        onSearchChange={vi.fn()}
      />,
    )

    const selectAll = screen.getByRole('checkbox', { name: 'Select visible rows' })
    const selectRow = screen.getByRole('checkbox', { name: 'Select row row-1' })

    expect(selectAll.parentElement?.parentElement).toHaveClass('data-list-sticky-leading')
    expect(selectRow.parentElement?.parentElement).toHaveClass('data-list-sticky-leading')
    expect(selectAll.parentElement).not.toHaveClass('data-list-sticky-cell')
    expect(selectRow.parentElement).not.toHaveClass('data-list-sticky-cell')
  })
})
