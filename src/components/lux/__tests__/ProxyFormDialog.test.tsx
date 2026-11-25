import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProxyFormDialog } from '../ProxyFormDialog';

// Regressao do bug do zodResolver com zod 4: o resolver do @hookform/resolvers 3
// relancava o ZodError (o zod 4 so expoe `.issues`, sem `.errors`) e o submit
// invalido nao exibia nenhuma mensagem de campo.
const mutateAsync = vi.fn();

vi.mock('@/hooks/useOrgProxies', () => ({
  useCreateProxy: () => ({ mutateAsync, isPending: false }),
  useUpdateProxy: () => ({ mutateAsync, isPending: false }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('ProxyFormDialog', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue(undefined);
  });

  it('mostra a mensagem de validacao no submit invalido em vez de lancar', async () => {
    render(<ProxyFormDialog open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    expect(await screen.findByText('Informe um rótulo')).toBeTruthy();
    expect(screen.getByText('URL inválida')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('envia os valores aparados quando o formulario e valido', async () => {
    const onOpenChange = vi.fn();
    render(<ProxyFormDialog open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText('Rótulo'), { target: { value: '  BR-SP-01  ' } });
    fireEvent.change(screen.getByLabelText('URL completa'), { target: { value: ' http://host:8080 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      label: 'BR-SP-01',
      url: 'http://host:8080',
      proxy_type: 'http',
      is_active: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
